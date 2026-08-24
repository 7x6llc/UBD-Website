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

  // Centralized Connect form behavior. This version is front-end only; secure Brevo/Netlify submission comes later.
  const form = document.getElementById('connect-form');
  if(form){
    const qs = new URLSearchParams(location.search);
    const typeEl = document.getElementById('INQUIRY_TYPE');
    const interestEl = document.getElementById('INTEREST');
    const dateEl = document.getElementById('INQUIRY_DATE');
    const generalWrap = document.getElementById('general-interest-wrap');
    const generalSelect = document.getElementById('GENERAL_INTEREST');
    const businessFields = document.getElementById('business-fields');
    const speakingFields = document.getElementById('speaking-fields');

    const normalizeType = v => ['Personal','Business','Speaking','General'].includes(v) ? v : 'General';
    let inquiryType = normalizeType(qs.get('type') || 'General');
    let interest = qs.get('interest') || '';

    function openConditional(el,open){
      if(!el) return;
      el.hidden = !open;
      requestAnimationFrame(()=>el.classList.toggle('open',open));
    }
    function setRequired(container,required){
      if(!container) return;
      container.querySelectorAll('input,select,textarea').forEach(el=>{
        if(required) el.setAttribute('required',''); else el.removeAttribute('required');
      });
    }
    function applyType(type){
      inquiryType = normalizeType(type);
      if(typeEl) typeEl.value = inquiryType;
      const isGeneral = inquiryType === 'General';
      const isBusiness = inquiryType === 'Business';
      const isSpeaking = inquiryType === 'Speaking';
      openConditional(generalWrap,isGeneral && !interest);
      openConditional(businessFields,isBusiness);
      openConditional(speakingFields,isSpeaking);
      setRequired(businessFields,isBusiness);
      setRequired(speakingFields,isSpeaking);
      if(isBusiness && !interest) interest='Unbecoming at Work';
      if(isSpeaking && !interest) interest='Speaking Engagement';
      if(interestEl && interest) interestEl.value=interest;
    }

    if(dateEl) dateEl.value = new Date().toISOString().slice(0,10);
    if(interestEl && interest) interestEl.value=interest;
    applyType(inquiryType);

    if(generalSelect){
      generalSelect.addEventListener('change',()=>{
        interest = generalSelect.value;
        if(interestEl) interestEl.value=interest;
        if(interest==='Unbecoming at Work') applyType('Business');
        else if(interest==='Speaking Engagement') applyType('Speaking');
        else if(['Personal Coaching','Unbecoming By Design','Human Design'].includes(interest)) applyType('Personal');
        else applyType('General');
      });
    }

    form.addEventListener('submit',(e)=>{
      e.preventDefault();
      if(!form.checkValidity()){
        form.reportValidity();
        return;
      }
      const success = document.getElementById('form-success');
      form.hidden = true;
      if(success) success.hidden = false;
    });
  }
})();
