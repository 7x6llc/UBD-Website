(function(){
  'use strict';

  // Reveal animations.
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    },{threshold:0.12});
    revealEls.forEach(el=>io.observe(el));
  } else {
    revealEls.forEach(el=>el.classList.add('in-view'));
  }

  // Contrast thread on homepage.
  const thread = document.getElementById('thread');
  if(thread && 'IntersectionObserver' in window){
    const tio = new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){thread.classList.add('in-view');tio.disconnect();}
      });
    },{threshold:0.3});
    tio.observe(thread);
  } else if(thread){thread.classList.add('in-view');}

  // Active navigation state.
  const current = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('nav.primary a[data-page]').forEach(a=>{
    if((a.dataset.page||'').toLowerCase()===current) a.classList.add('active');
  });

  // Mobile menu.
  const toggle = document.querySelector('.menu-toggle');
  const navList = document.querySelector('nav.primary ul');
  if(toggle && navList){
    toggle.addEventListener('click',()=>{
      const open = navList.classList.toggle('mobile-open');
      toggle.setAttribute('aria-expanded',open?'true':'false');
      if(open){
        Object.assign(navList.style,{
          display:'flex',flexDirection:'column',gap:'18px',position:'fixed',
          top:'69px',left:'0',right:'0',background:'#F5F1E8',padding:'28px 24px',
          borderBottom:'1px solid rgba(6,20,49,.1)',zIndex:'99'
        });
      }else{
        navList.removeAttribute('style');
      }
    });
    window.addEventListener('resize',()=>{
      if(window.innerWidth>980){navList.classList.remove('mobile-open');navList.removeAttribute('style');}
    });
  }

  // Centralized Connect form behavior + secure Netlify/Brevo submission.
  const form = document.getElementById('connect-form');
  if(form){
    const qs = new URLSearchParams(location.search);
    const typeEl = document.getElementById('INQUIRY_TYPE');
    const interestEl = document.getElementById('INTEREST');
    const dateEl = document.getElementById('INQUIRY_DATE');
    const businessFields = document.getElementById('business-fields');
    const speakingFields = document.getElementById('speaking-fields');
    const phoneEl = document.getElementById('SMS');
    const phoneLabel = document.getElementById('mobile-phone-label');
    const phoneHint = document.getElementById('mobile-phone-hint');
    const phoneRequiredMark = document.getElementById('phone-required-mark');
    const submitBtn = form.querySelector('.submit-btn');
    const errorEl = document.getElementById('form-error');

    const normalizeType = v => ['Personal','Business','Speaking','General'].includes(v) ? v : 'General';
    const normalizeInterest = v => {
      const map = {
        'Personal Coaching':'03- Unbecoming with Personal Coaching',
        'Group Program':'02 - Unbecoming Together',
        'Unbecoming By Design':'01 - Unbecoming at Your Own Pace',
        'Speaking Engagement':'Unbecoming Speaking Engagements'
      };
      return map[v] || v || '';
    };
    let inquiryType = normalizeType(qs.get('type') || 'General');
    let interest = normalizeInterest(qs.get('interest') || '');

    function openConditional(el,open){
      if(!el) return;
      el.hidden = !open;
      requestAnimationFrame(()=>el.classList.toggle('open',open));
    }
    function setRequired(container,required){
      if(!container) return;
      container.querySelectorAll('input,select,textarea').forEach(el=>{
        if(['LANDLINE_NUMBER','BUSINESS_SIZE'].includes(el.name)) return;
        if(required) el.setAttribute('required',''); else el.removeAttribute('required');
      });
    }
    function setPhoneRequirement(type){
      if(!phoneEl) return;
      const required = type !== 'Business';
      phoneEl.required = required;
      if(phoneRequiredMark) phoneRequiredMark.hidden = !required;
      if(phoneLabel) phoneLabel.childNodes[0].nodeValue = (type === 'Business') ? 'Mobile / Direct Phone' : 'Phone';
      if(phoneHint){
        phoneHint.textContent = required
          ? 'Required. Choose Yes or No below to tell us whether we may text you.'
          : 'Optional. Use a mobile/direct number if you would like Diana to be able to reach you personally.';
      }
      phoneEl.placeholder = required ? 'Phone number' : 'Optional';
    }
    function applyType(type){
      inquiryType = normalizeType(type);
      if(typeEl) typeEl.value = inquiryType;
      const isBusiness = inquiryType === 'Business';
      const isSpeaking = inquiryType === 'Speaking';
      openConditional(businessFields,isBusiness);
      openConditional(speakingFields,isSpeaking);
      setRequired(businessFields,isBusiness);
      setRequired(speakingFields,isSpeaking);
      setPhoneRequirement(inquiryType);
    }
    function typeForInterest(value){
      if(value === 'Unbecoming at Work') return 'Business';
      if(value === 'Unbecoming Speaking Engagements') return 'Speaking';
      if(['01 - Unbecoming at Your Own Pace','02 - Unbecoming Together','03- Unbecoming with Personal Coaching'].includes(value)) return 'Personal';
      return inquiryType;
    }

    if(dateEl) dateEl.value = new Date().toISOString().slice(0,10);
    if(interestEl && interest){
      const exists = [...interestEl.options].some(o=>o.value===interest);
      if(exists) interestEl.value=interest;
    }
    if(interest) inquiryType = typeForInterest(interest);
    applyType(inquiryType);

    if(interestEl){
      interestEl.addEventListener('change',()=>{
        interest = interestEl.value;
        applyType(typeForInterest(interest));
      });
    }

    form.addEventListener('submit',async (e)=>{
      e.preventDefault();
      if(!form.checkValidity()){
        form.reportValidity();
        return;
      }

      if(errorEl){ errorEl.hidden = true; errorEl.textContent = ''; }
      if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }

      try{
        const fd = new FormData(form);
        const payload = {};
        fd.forEach((value,key)=>{
          if(value !== '' || !(key in payload)) payload[key] = value;
        });
        payload.OPT_IN = document.getElementById('OPT_IN')?.checked || false;
        payload.SMS_OPT_IN = form.querySelector('input[name="SMS_OPT_IN"]:checked')?.value === 'true';
        payload.INQUIRY_TYPE = typeEl?.value || inquiryType;
        payload.INTEREST = interestEl?.value || interest;

        const res = await fetch('/.netlify/functions/submit-inquiry',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(payload)
        });
        const data = await res.json().catch(()=>({}));
        if(!res.ok) throw new Error(data.error || 'Your message could not be sent. Please try again.');

        const success = document.getElementById('form-success');
        form.hidden = true;
        if(success) success.hidden = false;
      }catch(err){
        if(errorEl){
          errorEl.textContent = err.message || 'Your message could not be sent. Please try again.';
          errorEl.hidden = false;
        }
      }finally{
        if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Send'; }
      }
    });
  }
})();
