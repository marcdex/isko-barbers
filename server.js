/**
 * ============================================================
 *  ISKO BARBERS — Backend Server v5.0
 *  Stack: Node.js + Express + sqlite3 + Nodemailer
 * ============================================================
 */
'use strict';
require('dotenv').config();

const express    = require('express');
const session    = require('express-session');
const bcrypt     = require('bcryptjs');
const nodemailer = require('nodemailer');
const sqlite3    = require('sqlite3').verbose();
const path       = require('path');
const fs         = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({ secret: process.env.SESSION_SECRET||'isko-dev-secret', resave:false, saveUninitialized:false, cookie:{secure:false,maxAge:1000*60*60*8} }));
app.use(express.static(path.join(__dirname,'public'), { index:false }));

const dbDir = path.join(__dirname,'db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);

const db = new sqlite3.Database(path.join(dbDir,'bookings.db'), err=>{
  if (err){ console.error('DB error:',err.message); process.exit(1); }
  console.log('✅ Database ready');
});

db.serialize(()=>{
  db.run('PRAGMA journal_mode = WAL');

  db.run(`CREATE TABLE IF NOT EXISTS barbers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, specialty TEXT NOT NULL DEFAULT 'All-around',
    experience TEXT NOT NULL DEFAULT '1 year', bio TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime')))`);

  db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL, last_name TEXT NOT NULL,
    phone TEXT NOT NULL, email TEXT DEFAULT '',
    service TEXT NOT NULL, price REAL NOT NULL DEFAULT 0,
    barber_id INTEGER DEFAULT NULL,
    date TEXT NOT NULL, time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (barber_id) REFERENCES barbers(id))`);

  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')))`);

  db.get('SELECT id FROM admins LIMIT 1', (_,row)=>{
    if (!row){
      const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD||'iskobarbers2025',10);
      db.run('INSERT INTO admins (username,password_hash) VALUES (?,?)',[process.env.ADMIN_USERNAME||'admin',hash]);
      console.log('✅ Admin: admin / iskobarbers2025');
    }
  });

  db.get('SELECT id FROM barbers LIMIT 1', (_,row)=>{
    if (!row){
      const stmt = db.prepare('INSERT INTO barbers (name,specialty,experience,bio) VALUES (?,?,?,?)');
      [['Isko Reyes','Fade & Taper Specialist','5 years','Master of clean fades and precise tapers. Known for sharp line-ups.'],
       ['Marco Santos','Classic Cuts & Shaves','3 years','Traditional cuts and hot towel straight razor shaves.'],
       ['Bryan Dizon','Modern Styles & Color','4 years','Expert in hair coloring, textured cuts and latest trends.'],
       ['Renz Villanueva','Kids & Senior Specialist','2 years','Patient and gentle with little ones and seniors.']
      ].forEach(b=>stmt.run(b));
      stmt.finalize();
      console.log('✅ Barbers seeded');
    }
  });
});

const dbGet=(sql,p=[])=>new Promise((res,rej)=>db.get(sql,p,(e,r)=>e?rej(e):res(r)));
const dbAll=(sql,p=[])=>new Promise((res,rej)=>db.all(sql,p,(e,r)=>e?rej(e):res(r)));
const dbRun=(sql,p=[])=>new Promise((res,rej)=>db.run(sql,p,function(e){e?rej(e):res({lastID:this.lastID,changes:this.changes})}));

const SERVICE_PRICES = {'Classic Modern Haircut':150,'Fade & Taper Cut':180,'Beard Trim & Shave':120,'Coloring & Highlights':350,'Scalp Treatment':200,'Kids & Senior Cut':100};
function priceFromService(s){ for(const [k,v] of Object.entries(SERVICE_PRICES)) if(s.includes(k)) return v; const m=s.match(/(\d+)/); return m?parseInt(m[1]):0; }

const mailer = nodemailer.createTransport({service:'gmail',auth:{user:process.env.GMAIL_USER,pass:process.env.GMAIL_PASS}});
async function sendConfirmation(booking, barberName){
  if (!process.env.GMAIL_USER||!booking.email) return;
  try {
    await mailer.sendMail({from:`"Isko Barbers" <${process.env.GMAIL_USER}>`,to:booking.email,
      subject:`✅ Booking #${booking.id} Confirmed`,
      html:`<h2>Hi ${booking.first_name}!</h2><p>Appointment confirmed at Isko Barbers.</p>
            <ul><li><b>Booking #:</b> ${booking.id}</li><li><b>Service:</b> ${booking.service}</li>
            ${barberName?`<li><b>Barber:</b> ${barberName}</li>`:''}
            <li><b>Date:</b> ${booking.date}</li><li><b>Time:</b> ${booking.time}</li>
            <li><b>Amount:</b> ₱${booking.price}</li></ul>
            <p>📍 Brgy. Malamig, Biñan, Laguna</p><p>See you soon! — Isko Barbers Team</p>`});
  } catch(e){ console.warn('[Email]',e.message); }
}

const VALID_SLOTS=['8:00 AM','9:00 AM','10:00 AM','11:00 AM','1:00 PM','2:00 PM','3:00 PM','4:00 PM'];
function validateBooking({first_name,last_name,phone,service,date,time}){
  if (!first_name||first_name.trim().length<2) return 'First name must be at least 2 characters.';
  if (!last_name||last_name.trim().length<2)   return 'Last name must be at least 2 characters.';
  if (!phone||phone.trim().length<7)           return 'A valid phone number is required.';
  if (!service||!service.trim())               return 'Please select a service.';
  if (!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'A valid date is required.';
  if (!VALID_SLOTS.includes(time))             return 'Please select a valid time slot.';
  return null;
}
const requireAuth=(req,res,next)=>req.session?.adminId?next():res.status(401).json({success:false,message:'Unauthorized.'});

app.get('/',(_,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.get('/admin.html',(req,res)=>req.session?.adminId?res.sendFile(path.join(__dirname,'public','admin.html')):res.redirect('/login.html'));

// Auth
app.post('/api/auth/login',async(req,res)=>{
  const {username,password}=req.body;
  if (!username||!password) return res.status(400).json({success:false,message:'Username and password required.'});
  try {
    const admin=await dbGet('SELECT * FROM admins WHERE username=?',[username]);
    if (!admin||!bcrypt.compareSync(password,admin.password_hash)) return res.status(401).json({success:false,message:'Invalid credentials.'});
    req.session.adminId=admin.id; req.session.adminUsername=admin.username;
    res.json({success:true});
  } catch(e){ res.status(500).json({success:false,message:'Server error.'}); }
});
app.post('/api/auth/logout',(req,res)=>req.session.destroy(()=>res.json({success:true})));
app.get('/api/auth/me',(req,res)=>req.session?.adminId?res.json({success:true,loggedIn:true,username:req.session.adminUsername}):res.json({success:true,loggedIn:false}));
app.post('/api/auth/change-password',requireAuth,async(req,res)=>{
  const {current_password,new_password}=req.body;
  if (!current_password||!new_password) return res.status(400).json({success:false,message:'Both fields required.'});
  if (new_password.length<8) return res.status(400).json({success:false,message:'Min 8 characters.'});
  try {
    const admin=await dbGet('SELECT * FROM admins WHERE id=?',[req.session.adminId]);
    if (!bcrypt.compareSync(current_password,admin.password_hash)) return res.status(401).json({success:false,message:'Current password incorrect.'});
    await dbRun('UPDATE admins SET password_hash=? WHERE id=?',[bcrypt.hashSync(new_password,10),req.session.adminId]);
    res.json({success:true,message:'Password changed.'});
  } catch(e){ res.status(500).json({success:false,message:'Server error.'}); }
});

// Barbers public
app.get('/api/barbers',async(_,res)=>{ try { res.json({success:true,barbers:await dbAll('SELECT * FROM barbers WHERE active=1 ORDER BY id')}); } catch(e){ res.status(500).json({success:false,message:'Server error.'}); }});
// Barbers admin
app.get('/api/barbers/all',requireAuth,async(_,res)=>{ try { res.json({success:true,barbers:await dbAll('SELECT * FROM barbers ORDER BY id')}); } catch(e){ res.status(500).json({success:false,message:'Server error.'}); }});
app.post('/api/barbers',requireAuth,async(req,res)=>{
  const {name,specialty,experience,bio}=req.body;
  if (!name?.trim()) return res.status(400).json({success:false,message:'Name required.'});
  try { const r=await dbRun('INSERT INTO barbers (name,specialty,experience,bio) VALUES (?,?,?,?)',[name.trim(),specialty||'All-around',experience||'1 year',bio||'']); res.status(201).json({success:true,barber:await dbGet('SELECT * FROM barbers WHERE id=?',[r.lastID])}); } catch(e){ res.status(500).json({success:false,message:'Server error.'}); }
});
app.put('/api/barbers/:id',requireAuth,async(req,res)=>{
  const {name,specialty,experience,bio,active}=req.body;
  try { const r=await dbRun('UPDATE barbers SET name=?,specialty=?,experience=?,bio=?,active=? WHERE id=?',[name,specialty,experience,bio,active??1,req.params.id]); if (!r.changes) return res.status(404).json({success:false,message:'Not found.'}); res.json({success:true,barber:await dbGet('SELECT * FROM barbers WHERE id=?',[req.params.id])}); } catch(e){ res.status(500).json({success:false,message:'Server error.'}); }
});
app.delete('/api/barbers/:id',requireAuth,async(req,res)=>{
  try { const r=await dbRun('UPDATE barbers SET active=0 WHERE id=?',[req.params.id]); if (!r.changes) return res.status(404).json({success:false,message:'Not found.'}); res.json({success:true}); } catch(e){ res.status(500).json({success:false,message:'Server error.'}); }
});

// Bookings public
app.post('/api/bookings',async(req,res)=>{
  const {first_name,last_name,phone,email,service,barber_id,date,time,notes}=req.body;
  const err=validateBooking({first_name,last_name,phone,service,date,time});
  if (err) return res.status(400).json({success:false,message:err});
  const effectiveBarberId=(barber_id&&barber_id!=='any')?barber_id:null;
  const price=priceFromService(service||'');
  try {
    const conflict=effectiveBarberId
      ?await dbGet('SELECT id FROM bookings WHERE date=? AND time=? AND barber_id=? AND status!="cancelled"',[date,time,effectiveBarberId])
      :await dbGet('SELECT id FROM bookings WHERE date=? AND time=? AND status!="cancelled"',[date,time]);
    if (conflict) return res.status(409).json({success:false,message:`${time} on ${date} is already taken. Please choose another slot.`});
    const r=await dbRun('INSERT INTO bookings (first_name,last_name,phone,email,service,price,barber_id,date,time,notes) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [first_name.trim(),last_name.trim(),phone.trim(),(email||'').trim(),service.trim(),price,effectiveBarberId,date,time,(notes||'').trim()]);
    const booking=await dbGet('SELECT * FROM bookings WHERE id=?',[r.lastID]);
    let barberName=null;
    if (effectiveBarberId){ const b=await dbGet('SELECT name FROM barbers WHERE id=?',[effectiveBarberId]); barberName=b?.name||null; }
    sendConfirmation(booking,barberName);
    res.status(201).json({success:true,message:'Booking confirmed!',bookingId:booking.id,barberName,price});
  } catch(e){ console.error(e); res.status(500).json({success:false,message:'Server error.'}); }
});

app.get('/api/bookings/slots',async(req,res)=>{
  const {date,barber_id}=req.query;
  if (!date) return res.status(400).json({success:false,message:'date required.'});
  try {
    const rows=(barber_id&&barber_id!=='any')
      ?await dbAll('SELECT time FROM bookings WHERE date=? AND barber_id=? AND status!="cancelled"',[date,barber_id])
      :await dbAll('SELECT time FROM bookings WHERE date=? AND status!="cancelled"',[date]);
    res.json({success:true,date,slots:rows.map(r=>r.time)});
  } catch(e){ res.status(500).json({success:false,message:'Server error.'}); }
});

app.get('/api/bookings/lookup',async(req,res)=>{
  const {phone}=req.query;
  if (!phone||phone.trim().length<7) return res.status(400).json({success:false,message:'Enter a valid phone number.'});
  try {
    const bookings=await dbAll(
      `SELECT b.id,b.first_name,b.last_name,b.service,b.price,b.date,b.time,b.status,b.notes,b.created_at,bar.name as barber_name
       FROM bookings b LEFT JOIN barbers bar ON b.barber_id=bar.id WHERE b.phone LIKE ? ORDER BY b.date DESC LIMIT 10`,
      [`%${phone.trim().replace(/\s/g,'')}%`]);
    const completedCount=bookings.filter(b=>b.status==='completed').length;
    let voucherTier=null;
    if (completedCount>=5) voucherTier={discount:30,label:'30% OFF — Tier 3 Loyal Customer 🏆'};
    else if (completedCount>=3) voucherTier={discount:20,label:'20% OFF — Tier 2 Regular Customer ⭐'};
    else if (completedCount>=1) voucherTier={discount:1,label:'1% OFF — Tier 1 Welcome Discount 🎉'};
    res.json({success:true,count:bookings.length,bookings,completedCount,voucherTier});
  } catch(e){ res.status(500).json({success:false,message:'Server error.'}); }
});

// Bookings admin
app.get('/api/bookings',requireAuth,async(req,res)=>{
  const {date,status,search,barber_id}=req.query;
  let q=`SELECT b.*,bar.name as barber_name FROM bookings b LEFT JOIN barbers bar ON b.barber_id=bar.id WHERE 1=1`;
  const p=[];
  if (date){q+=' AND b.date=?';p.push(date);} if (status){q+=' AND b.status=?';p.push(status);} if (barber_id){q+=' AND b.barber_id=?';p.push(barber_id);}
  if (search){q+=' AND (b.first_name LIKE ? OR b.last_name LIKE ? OR b.phone LIKE ?)';p.push(`%${search}%`,`%${search}%`,`%${search}%`);}
  q+=' ORDER BY b.date ASC,b.time ASC';
  try { res.json({success:true,count:(await dbAll(q,p)).length,bookings:await dbAll(q,p)}); } catch(e){ res.status(500).json({success:false,message:'Server error.'}); }
});

app.get('/api/analytics',requireAuth,async(_,res)=>{
  const todayStr=new Date().toISOString().split('T')[0];
  const now=new Date(); const mon=new Date(now); mon.setDate(now.getDate()-(now.getDay()||7)+1); mon.setHours(0,0,0,0);
  const weekStart=mon.toISOString().split('T')[0];
  const thisMonth=todayStr.slice(0,7); const thisYear=todayStr.slice(0,4);
  try {
    const [total,todayRow,weekRow,upcomingRow,cancelledRow,daily,services,hours,topBarbers,incomeToday,incomeWeek,incomeMonth,incomeYear,recentBookings,monthlyIncome]=await Promise.all([
      dbGet('SELECT COUNT(*) as c FROM bookings'),
      dbGet('SELECT COUNT(*) as c FROM bookings WHERE date=?',[todayStr]),
      dbGet('SELECT COUNT(*) as c FROM bookings WHERE date>=?',[weekStart]),
      dbGet('SELECT COUNT(*) as c FROM bookings WHERE date>=? AND status!="cancelled"',[todayStr]),
      dbGet('SELECT COUNT(*) as c FROM bookings WHERE status="cancelled"'),
      dbAll(`SELECT date,COUNT(*) as count FROM bookings WHERE date>=date('now','-14 days') GROUP BY date ORDER BY date ASC`),
      dbAll(`SELECT service,COUNT(*) as count FROM bookings WHERE status!='cancelled' GROUP BY service ORDER BY count DESC LIMIT 6`),
      dbAll(`SELECT time,COUNT(*) as count FROM bookings WHERE status!='cancelled' GROUP BY time ORDER BY count DESC`),
      dbAll(`SELECT bar.name,COUNT(*) as count FROM bookings b LEFT JOIN barbers bar ON b.barber_id=bar.id WHERE b.status!='cancelled' AND bar.name IS NOT NULL GROUP BY b.barber_id ORDER BY count DESC LIMIT 5`),
      dbGet(`SELECT COALESCE(SUM(price),0) as total FROM bookings WHERE date=? AND status='completed'`,[todayStr]),
      dbGet(`SELECT COALESCE(SUM(price),0) as total FROM bookings WHERE date>=? AND status='completed'`,[weekStart]),
      dbGet(`SELECT COALESCE(SUM(price),0) as total FROM bookings WHERE strftime('%Y-%m',date)=? AND status='completed'`,[thisMonth]),
      dbGet(`SELECT COALESCE(SUM(price),0) as total FROM bookings WHERE strftime('%Y',date)=? AND status='completed'`,[thisYear]),
      dbAll(`SELECT b.*,bar.name as barber_name FROM bookings b LEFT JOIN barbers bar ON b.barber_id=bar.id ORDER BY b.created_at DESC LIMIT 5`),
      dbAll(`SELECT strftime('%Y-%m',date) as month,COALESCE(SUM(price),0) as total FROM bookings WHERE status='completed' AND date>=date('now','-6 months') GROUP BY month ORDER BY month ASC`),
    ]);
    res.json({success:true,stats:{total:total.c,today:todayRow.c,week:weekRow.c,upcoming:upcomingRow.c,cancelled:cancelledRow.c},income:{today:incomeToday.total,week:incomeWeek.total,month:incomeMonth.total,year:incomeYear.total},daily,services,hours,topBarbers,monthlyIncome,recentBookings});
  } catch(e){ console.error(e); res.status(500).json({success:false,message:'Server error.'}); }
});

app.patch('/api/bookings/:id/status',requireAuth,async(req,res)=>{
  const {status}=req.body;
  if (!['confirmed','completed','cancelled','no-show'].includes(status)) return res.status(400).json({success:false,message:'Invalid status.'});
  try { const r=await dbRun('UPDATE bookings SET status=? WHERE id=?',[status,req.params.id]); if (!r.changes) return res.status(404).json({success:false,message:'Not found.'}); res.json({success:true}); } catch(e){ res.status(500).json({success:false,message:'Server error.'}); }
});
app.patch('/api/bookings/:id/notes',requireAuth,async(req,res)=>{ try { await dbRun('UPDATE bookings SET notes=? WHERE id=?',[req.body.notes||'',req.params.id]); res.json({success:true}); } catch(e){ res.status(500).json({success:false,message:'Server error.'}); }});
app.delete('/api/bookings/:id',requireAuth,async(req,res)=>{ try { const r=await dbRun('DELETE FROM bookings WHERE id=?',[req.params.id]); if (!r.changes) return res.status(404).json({success:false,message:'Not found.'}); res.json({success:true}); } catch(e){ res.status(500).json({success:false,message:'Server error.'}); }});

app.get('/api/export/csv',requireAuth,async(_,res)=>{
  try {
    const rows=await dbAll(`SELECT b.id,b.first_name,b.last_name,b.phone,b.email,b.service,b.price,bar.name as barber,b.date,b.time,b.status,b.notes,b.created_at FROM bookings b LEFT JOIN barbers bar ON b.barber_id=bar.id ORDER BY b.date,b.time`);
    const hdr='ID,First,Last,Phone,Email,Service,Price,Barber,Date,Time,Status,Notes,Created';
    const csv=rows.map(b=>[b.id,b.first_name,b.last_name,b.phone,b.email||'',`"${b.service}"`,b.price,b.barber||'Any',b.date,b.time,b.status,`"${(b.notes||'').replace(/"/g,'""')}"`,b.created_at].join(',')).join('\n');
    res.setHeader('Content-Type','text/csv'); res.setHeader('Content-Disposition',`attachment; filename="isko-bookings-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(hdr+'\n'+csv);
  } catch(e){ res.status(500).json({success:false,message:'Server error.'}); }
});

app.listen(PORT,()=>{
  console.log(`\n🪒  Isko Barbers v5.0 → http://localhost:${PORT}`);
  console.log(`    Admin  → http://localhost:${PORT}/admin.html\n`);
});
