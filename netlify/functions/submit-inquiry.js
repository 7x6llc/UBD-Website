const BREVO_API = 'https://api.brevo.com/v3';
const DEFAULT_LIST_NAME = 'Unbecoming By Design — Website Leads';

function json(statusCode, body){
  return {
    statusCode,
    headers:{'Content-Type':'application/json; charset=utf-8'},
    body:JSON.stringify(body)
  };
}

function text(v, max=5000){
  return String(v ?? '').trim().slice(0,max);
}

function bool(v){
  return v === true || v === 'true' || v === '1' || v === 1 || v === 'yes' || v === 'Yes';
}

function normalizePhone(v){
  const raw = text(v,100);
  if(!raw) return '';
  const digits = raw.replace(/\D/g,'');
  if(digits.length === 10) return `+1${digits}`;
  if(digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if(raw.startsWith('+') && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return '';
}

function escapeHtml(v){
  return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function brevo(path, apiKey, options={}){
  const res = await fetch(`${BREVO_API}${path}`,{
    ...options,
    headers:{
      'accept':'application/json',
      'content-type':'application/json',
      'api-key':apiKey,
      ...(options.headers || {})
    }
  });
  const raw = await res.text();
  let data = {};
  try{ data = raw ? JSON.parse(raw) : {}; }catch{ data = {message:raw}; }
  if(!res.ok){
    const err = new Error(data.message || `Brevo request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function resolveCategoryValue(apiKey, attributeName, label){
  try{
    const data = await brevo('/contacts/attributes', apiKey, {method:'GET'});
    const attr = (data.attributes || []).find(a=>a.name === attributeName);
    if(!attr || !Array.isArray(attr.enumeration)) return label;
    const option = attr.enumeration.find(o=>String(o.label).toLowerCase() === String(label).toLowerCase());
    if(!option) return label;
    const raw = option.valueStr ?? option.value ?? label;
    return /^-?\d+$/.test(String(raw)) ? Number(raw) : raw;
  }catch{
    return label;
  }
}

async function resolveListId(apiKey){
  const configuredId = Number(process.env.BREVO_LIST_ID || 0);
  if(configuredId) return configuredId;
  const wanted = process.env.BREVO_LIST_NAME || DEFAULT_LIST_NAME;
  try{
    const data = await brevo('/contacts/lists?limit=50&offset=0&sort=desc', apiKey, {method:'GET'});
    const list = (data.lists || []).find(l=>String(l.name).trim() === wanted);
    return list ? Number(list.id) : null;
  }catch{
    return null;
  }
}

exports.handler = async function(event){
  if(event.httpMethod !== 'POST') return json(405,{error:'Method not allowed.'});

  const apiKey = process.env.BREVO_API_KEY;
  if(!apiKey) return json(500,{error:'The contact service is not configured yet.'});

  let body;
  try{ body = JSON.parse(event.body || '{}'); }
  catch{ return json(400,{error:'Invalid form submission.'}); }

  // Honeypot: bots often fill hidden fields.
  if(text(body.website,200)) return json(200,{ok:true});

  const email = text(body.EMAIL,254).toLowerCase();
  const first = text(body.FIRSTNAME,100);
  const last = text(body.LASTNAME,100);
  const interest = text(body.INTEREST,200);
  const message = text(body.MESSAGE,6000);
  const inquiryType = ['Personal','Business','Speaking','General'].includes(body.INQUIRY_TYPE)
    ? body.INQUIRY_TYPE : 'General';
  const smsPhone = normalizePhone(body.SMS);

  if(!first || !last || !email || !interest || !message){
    return json(400,{error:'Please complete all required fields.'});
  }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    return json(400,{error:'Please enter a valid email address.'});
  }
  if(inquiryType !== 'Business' && !smsPhone){
    return json(400,{error:'Please enter a valid phone number.'});
  }
  if(text(body.SMS,100) && !smsPhone){
    return json(400,{error:'Please enter a valid phone number.'});
  }

  

  if(inquiryType === 'Business'){
    if(!text(body.BUSINESS_NAME,200) || !text(body.GROUP_SIZE,100)){
      return json(400,{error:'Please include the business name and approximate group size.'});
    }
  }
  if(inquiryType === 'Speaking'){
    if(!text(body.BUSINESS_NAME,200) || !text(body.EVENT_NAME,200) || !text(body.EVENT_DATE,40) ||
       !text(body.EVENT_LOCATION,250) || !text(body.AUDIENCE_SIZE,100)){
      return json(400,{error:'Please complete the speaking engagement details.'});
    }
  }

  const inquiryDate = new Date().toISOString().slice(0,10);
  const categoryValue = await resolveCategoryValue(apiKey,'INQUIRY_TYPE',inquiryType);

  // Preserve older inquiry text when the contact already exists.
  let storedMessage = message;
  try{
    const existing = await brevo(`/contacts/${encodeURIComponent(email)}`,apiKey,{method:'GET'});
    const previous = text(existing?.attributes?.MESSAGE,12000);
    if(previous && previous !== message){
      storedMessage = `${previous}\n\n--- Website inquiry ${inquiryDate} ---\n${message}`.slice(-18000);
    }
  }catch(err){
    if(err.status !== 404) console.warn('Brevo contact lookup warning:',err.message);
  }

  const attributes = {
    FIRSTNAME:first,
    LASTNAME:last,
    INTEREST:interest,
    MESSAGE:storedMessage,
    LEAD_SOURCE:'Website',
    INQUIRY_TYPE:categoryValue,
    INQUIRY_DATE:inquiryDate,
    SMS:smsPhone,
    OPT_IN:bool(body.OPT_IN),
    SMS_OPT_IN:bool(body.SMS_OPT_IN)
  };

  if(inquiryType === 'Business'){
    Object.assign(attributes,{
      BUSINESS_NAME:text(body.BUSINESS_NAME,200),
      BUSINESS_SIZE:text(body.BUSINESS_SIZE,100),
      GROUP_SIZE:text(body.GROUP_SIZE,100),
      LANDLINE_NUMBER:text(body.LANDLINE_NUMBER,100)
    });
  }

  if(inquiryType === 'Speaking'){
    Object.assign(attributes,{
      BUSINESS_NAME:text(body.BUSINESS_NAME,200),
      EVENT_NAME:text(body.EVENT_NAME,200),
      EVENT_DATE:text(body.EVENT_DATE,40),
      EVENT_LOCATION:text(body.EVENT_LOCATION,250),
      AUDIENCE_SIZE:text(body.AUDIENCE_SIZE,100)
    });
  }

  // Avoid sending empty attributes; Brevo otherwise may overwrite useful existing data with blanks.
  Object.keys(attributes).forEach(k=>{
    if(attributes[k] === '' || attributes[k] == null) delete attributes[k];
  });

  const listId = await resolveListId(apiKey);
  const payload = {
    email,
    attributes,
    updateEnabled:true
  };
  if(listId) payload.listIds = [listId];

  try{
    await brevo('/contacts',apiKey,{method:'POST',body:JSON.stringify(payload)});

    // Transactional confirmation email. This is not marketing; it confirms receipt of the inquiry.
    const fromEmail = text(process.env.BREVO_FROM_EMAIL,254);
    if(fromEmail){
      const fromName = text(process.env.BREVO_FROM_NAME,120) || 'Diana Lynn | Unbecoming By Design';
      const replyTo = text(process.env.BREVO_REPLY_TO_EMAIL,254) || fromEmail;
      const firstSafe = escapeHtml(first);
      const autoPayload = {
        sender:{name:fromName,email:fromEmail},
        to:[{email,name:`${first} ${last}`.trim()}],
        replyTo:{email:replyTo,name:'Diana Lynn'},
        subject:'Thank you for connecting with Unbecoming By Design',
        htmlContent:`
          <div style="font-family:Arial,Helvetica,sans-serif;color:#061431;line-height:1.65;max-width:620px;margin:auto;">
            <p>Hi ${firstSafe},</p>
            <p>Thank you for reaching out to Unbecoming By Design. Your message has been received, and I personally read every inquiry.</p>
            <p>I’ll be in touch soon. In the meantime, thank you for taking the time to tell me a little about where you are and what you’re considering.</p>
            <p>Warmly,<br>Diana Lynn<br>Unbecoming By Design™</p>
            <p style="font-size:12px;color:#626B33;">Unbecoming the expectations. Living by your design.</p>
          </div>`
      };
      try{
        await brevo('/smtp/email',apiKey,{method:'POST',body:JSON.stringify(autoPayload)});
      }catch(emailErr){
        // Do not fail the inquiry if the confirmation email has a temporary problem.
        console.warn('Brevo confirmation email warning:',emailErr.status,emailErr.data || emailErr.message);
      }
    }

    return json(200,{ok:true});
  }catch(err){
    console.error('Brevo submission error:',err.status,err.data || err.message);
    return json(502,{error:'Your message could not be saved right now. Please try again in a few minutes.'});
  }
};
