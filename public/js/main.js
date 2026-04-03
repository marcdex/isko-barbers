/**
 * ISKO BARBERS — Frontend v5.0
 * Barbers, booking lookup, loyalty tiers, calendar, form UX
 */
'use strict';

const TIME_SLOTS = ['8:00 AM','9:00 AM','10:00 AM','11:00 AM','1:00 PM','2:00 PM','3:00 PM','4:00 PM'];
const AVATAR_COLORS = [
  {bg:'#f5c518',color:'#000'},{bg:'#1565c0',color:'#fff'},
  {bg:'#2e7d32',color:'#fff'},{bg:'#6a1b9a',color:'#fff'},
  {bg:'#c62828',color:'#fff'},{bg:'#00695c',color:'#fff'}
];

/* ── NAV ──────────────────────────────────────────────── */
function handleNavScroll(){ document.querySelector('.nav')?.classList.toggle('scrolled',window.scrollY>60); }
function toggleMenu(){
  const h=document.getElementById('hamburger'), m=document.getElementById('mobileMenu');
  const open=h.classList.toggle('open');
  m.classList.toggle('open',open);
  document.body.style.overflow=open?'hidden':'';
}
function closeMenu(){
  document.getElementById('hamburger')?.classList.remove('open');
  document.getElementById('mobileMenu')?.classList.remove('open');
  document.body.style.overflow='';
}

/* ── MODAL ────────────────────────────────────────────── */
function openModal(barberId){
  const o=document.getElementById('modalOverlay');
  if(!o) return;
  o.classList.add('open');
  document.body.style.overflow='hidden';
  document.getElementById('modalFormArea').style.display='block';
  document.getElementById('modalSuccess').style.display='none';
  const btn=document.querySelector('#modalFormArea .form__submit');
  if(btn){btn.textContent='Confirm Booking →';btn.disabled=false;}
  if(barberId){const s=document.getElementById('mbarber');if(s)s.value=barberId;}
}
function closeModal(){
  document.getElementById('modalOverlay')?.classList.remove('open');
  document.body.style.overflow='';
}

/* ── LOAD BARBERS ─────────────────────────────────────── */
async function loadBarbers(){
  try {
    const data=await fetch('/api/barbers').then(r=>r.json());
    if(!data.success||!data.barbers.length) return;
    const grid=document.getElementById('teamGrid');
    if(grid){
      grid.innerHTML=data.barbers.map((b,i)=>{
        const initials=b.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
        const c=AVATAR_COLORS[i%AVATAR_COLORS.length];
        return `<div class="team-card fade-up">
          <div class="team-card__avatar" style="background:${c.bg};color:${c.color}">${initials}</div>
          <div class="team-card__name">${esc(b.name)}</div>
          <div class="team-card__specialty">${esc(b.specialty)}</div>
          <div class="team-card__experience">📅 ${esc(b.experience)} experience</div>
          ${b.bio?`<div class="team-card__bio">${esc(b.bio)}</div>`:''}
          <button class="team-card__book-btn" onclick="openModal(${b.id})">Book with ${esc(b.name.split(' ')[0])} →</button>
        </div>`;
      }).join('');
      document.querySelectorAll('.team-card.fade-up').forEach(el=>scrollObserver?.observe(el));
    }
    const opts=`<option value="any">Any Available Barber</option>`+data.barbers.map(b=>`<option value="${b.id}">${esc(b.name)} — ${esc(b.specialty)}</option>`).join('');
    ['barber','mbarber'].forEach(id=>{const s=document.getElementById(id);if(s)s.innerHTML=opts;});
  } catch(e){ console.warn('Could not load barbers'); }
}

/* ── TIME SLOTS ───────────────────────────────────────── */
async function loadBookedSlots(timeSelectId,date,barberId){
  if(!date) return;
  const select=document.getElementById(timeSelectId);
  if(!select) return;
  renderSlots(select,TIME_SLOTS,[]);
  try {
    const bp=barberId&&barberId!=='any'?`&barber_id=${barberId}`:'';
    const data=await fetch(`/api/bookings/slots?date=${date}${bp}`).then(r=>r.json());
    renderSlots(select,TIME_SLOTS,Array.isArray(data.slots)?data.slots:[]);
  } catch(e){}
}
function renderSlots(select,all,booked){
  select.innerHTML=all.map(s=>{
    const taken=booked.includes(s);
    return `<option value="${s}"${taken?' disabled':''}>${taken?s+' — Booked':s}</option>`;
  }).join('');
  const free=all.find(s=>!booked.includes(s));
  if(free) select.value=free;
}

/* ── VALIDATION ───────────────────────────────────────── */
function validateBookingData(d){
  if(!d.first_name||d.first_name.length<2) return 'Please enter your first name (min 2 characters).';
  if(!d.last_name||d.last_name.length<2)   return 'Please enter your last name (min 2 characters).';
  if(!d.phone||d.phone.length<7)           return 'Please enter a valid phone number.';
  if(!d.service)                           return 'Please select a service.';
  if(!d.date)                              return 'Please select a date.';
  const today=new Date(); today.setHours(0,0,0,0);
  if(new Date(d.date)<today)               return 'Please select a future date.';
  if(!d.time)                              return 'Please select a time slot.';
  return null;
}

/* ── SUBMIT BOOKING ───────────────────────────────────── */
async function sendBooking(source){
  const modal=source==='modal';
  const p=modal?'m':'';
  const data={
    first_name:document.getElementById(`${p}fname`)?.value.trim()||'',
    last_name:document.getElementById(`${p}lname`)?.value.trim()||'',
    phone:document.getElementById(`${p}phone`)?.value.trim()||'',
    email:document.getElementById(modal?'memail':'pemail')?.value.trim()||'',
    service:document.getElementById(`${p}service`)?.value.trim()||'',
    barber_id:document.getElementById(modal?'mbarber':'barber')?.value||'any',
    date:document.getElementById(`${p}apptDate`)?.value||'',
    time:document.getElementById(`${p}apptTime`)?.value||'',
    notes:document.getElementById(modal?'mnotes':'pnotes')?.value.trim()||'',
  };
  const errorEl=document.getElementById(modal?'modalError':'pageError');
  const submitBtn=document.getElementById(modal?'modalSubmitBtn':'pageSubmitBtn');
  const formArea=document.getElementById(modal?'modalFormArea':'pageFormArea');
  const successEl=document.getElementById(modal?'modalSuccess':'successMsg');

  errorEl.style.display='none'; errorEl.textContent='';
  const ve=validateBookingData(data);
  if(ve){ showErr(errorEl,ve); return; }
  submitBtn.disabled=true; submitBtn.textContent='Sending…';

  try {
    const res=await fetch('/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    const result=await res.json();
    if(result.success){
      const detEl=document.getElementById(modal?'modalSuccessDetails':'pageSuccessDetails');
      if(detEl){
        let msg=`Booking #<strong>${result.bookingId}</strong> confirmed!`;
        if(result.barberName) msg+=` Your barber: <strong>${esc(result.barberName)}</strong>.`;
        if(result.price) msg+=` Total: <strong>₱${result.price}</strong>.`;
        msg+=' See you soon!';
        detEl.innerHTML=msg;
      }
      formArea.style.display='none'; successEl.style.display='block';
    } else { showErr(errorEl,result.message||'Something went wrong.'); }
  } catch(e){ showErr(errorEl,'Cannot connect to server. Make sure it is running.'); }
  finally { submitBtn.disabled=false; submitBtn.textContent='Confirm Booking →'; }
}
function submitForm()  { sendBooking('page'); }
function submitModal() { sendBooking('modal'); }

/* ── RESET FORMS ──────────────────────────────────────── */
function clearFields(ids){ ids.forEach(id=>{ const el=document.getElementById(id); if(!el)return; el.tagName==='SELECT'?(el.selectedIndex=0):(el.value=''); }); }
function resetPageForm(){
  clearFields(['fname','lname','phone','pemail','service','barber','apptDate','apptTime','pnotes']);
  document.getElementById('pageError').style.display='none';
  document.getElementById('pageFormArea').style.display='block';
  document.getElementById('successMsg').style.display='none';
}
function resetModalForm(){
  clearFields(['mfname','mlname','mphone','memail','mservice','mbarber','mapptDate','mapptTime','mnotes']);
  document.getElementById('modalError').style.display='none';
  document.getElementById('modalFormArea').style.display='block';
  document.getElementById('modalSuccess').style.display='none';
}

/* ── BOOKING LOOKUP ───────────────────────────────────── */
async function lookupBooking(){
  const phone=document.getElementById('lookupPhone')?.value.trim();
  const errorEl=document.getElementById('lookupError');
  const resultsEl=document.getElementById('lookupResults');
  errorEl.style.display='none'; resultsEl.innerHTML='';
  if(!phone||phone.length<7){ errorEl.textContent='⚠ Please enter a valid phone number.'; errorEl.style.display='block'; return; }
  resultsEl.innerHTML='<p style="color:var(--color-muted);font-size:.9rem;padding:16px 0">Searching…</p>';
  try {
    const data=await fetch(`/api/bookings/lookup?phone=${encodeURIComponent(phone)}`).then(r=>r.json());
    if(!data.success){ resultsEl.innerHTML='<div class="lookup-no-results">Something went wrong. Try again.</div>'; return; }
    if(data.count===0){ resultsEl.innerHTML=`<div class="lookup-no-results">No bookings found for <strong>${esc(phone)}</strong>.<br>Double-check your number or <a href="#contact" style="color:var(--color-gold)">book a new appointment</a>.</div>`; return; }

    let html='';
    // Voucher tier banner
    if(data.voucherTier){
      html+=`<div class="lookup-voucher">
        <div class="lookup-voucher__icon">🎟️</div>
        <div class="lookup-voucher__text">
          <strong>${esc(data.voucherTier.label)}</strong>
          <span>You have completed ${data.completedCount} visit${data.completedCount!==1?'s':''}. Show this at the shop to claim your discount!</span>
        </div>
      </div>`;
    }
    html+=`<p class="lookup-count">${data.count} booking${data.count!==1?'s':''} found:</p>`;
    html+=data.bookings.map(b=>`
      <div class="lookup-booking-card">
        <div class="lookup-booking-card__header">
          <span class="lookup-booking-card__id">BOOKING #${b.id}</span>
          <span class="lookup-booking-status status--${b.status}">${b.status.toUpperCase()}</span>
        </div>
        <div class="lookup-booking-card__details">
          <div><strong>Customer</strong><br>${esc(b.first_name)} ${esc(b.last_name)}</div>
          <div><strong>Service</strong><br>${esc(b.service.replace(/ – ₱\d+/,''))}</div>
          <div><strong>Date &amp; Time</strong><br>${esc(b.date)} at ${esc(b.time)}</div>
          <div><strong>Barber</strong><br>${b.barber_name?esc(b.barber_name):'Any Available'}</div>
          ${b.price?`<div><strong>Amount</strong><br>₱${b.price}</div>`:''}
          ${b.notes?`<div style="grid-column:1/-1"><strong>Notes</strong><br>${esc(b.notes)}</div>`:''}
        </div>
      </div>`).join('');
    resultsEl.innerHTML=html;
  } catch(e){ resultsEl.innerHTML='<div class="lookup-no-results">Connection error. Make sure the server is running.</div>'; }
}

/* ── STYLE TABS ───────────────────────────────────────── */
function switchTab(btn,tab){
  document.querySelectorAll('.styles__tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-men').style.display=tab==='men'?'grid':'none';
  document.getElementById('tab-kids').style.display=tab==='kids'?'grid':'none';
}

/* ── SCROLL ANIMATIONS ────────────────────────────────── */
let scrollObserver;
function initScrollAnimations(){
  scrollObserver=new IntersectionObserver(entries=>{
    entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('visible'); scrollObserver.unobserve(e.target); }});
  },{threshold:0.08});
  document.querySelectorAll('.fade-up').forEach(el=>scrollObserver.observe(el));
}

/* ── UTILS ────────────────────────────────────────────── */
function showErr(el,msg){ el.textContent='⚠ '+msg; el.style.display='block'; }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ── INIT ─────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded',()=>{
  const today=new Date().toISOString().split('T')[0];
  ['apptDate','mapptDate'].forEach(id=>{ const el=document.getElementById(id); if(el) el.min=today; });

  document.getElementById('apptDate')?.addEventListener('change',e=>{
    loadBookedSlots('apptTime',e.target.value,document.getElementById('barber')?.value||'any');
  });
  document.getElementById('mapptDate')?.addEventListener('change',e=>{
    loadBookedSlots('mapptTime',e.target.value,document.getElementById('mbarber')?.value||'any');
  });
  document.getElementById('barber')?.addEventListener('change',()=>{
    const d=document.getElementById('apptDate')?.value;
    if(d) loadBookedSlots('apptTime',d,document.getElementById('barber').value);
  });
  document.getElementById('mbarber')?.addEventListener('change',()=>{
    const d=document.getElementById('mapptDate')?.value;
    if(d) loadBookedSlots('mapptTime',d,document.getElementById('mbarber').value);
  });

  document.getElementById('lookupPhone')?.addEventListener('keydown',e=>{ if(e.key==='Enter') lookupBooking(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeModal(); });
  window.addEventListener('scroll',handleNavScroll,{passive:true});

  initScrollAnimations();
  loadBarbers();
});
