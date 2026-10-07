/* ===== Know Your Mind — quiz engine ===== */
const TYPES={
  overthinker:{emoji:'🌀',ar:'المفكّر العميق',en:'THE OVERTHINKER',
    desc:'عقلك ما يهدأ! تحلّل كل موقف من كل زاوية، وتفكر قبل ما تتكلم وبعد ما تتكلم. حساسيتك العالية ميزة… بس أحيانًا تتعبك.',
    traits:['تحليل عميق','حساسية عالية','تخطيط مسبق','قلق صامت'],
    tip:'عقلك يحفظ كل شي… والتطبيقات كذلك. لا تخلي قلقك يصير بيانات.'},
  openbook:{emoji:'💬',ar:'الكتاب المفتوح',en:'THE OPEN BOOK',
    desc:'صريح وقريب من الناس. تشارك مشاعرك بسهولة وما تحب تخبّي شي. دفؤك يجذب الناس… وأيضًا يجذب التطبيقات اللي تجمع بياناتك.',
    traits:['صراحة','تواصل اجتماعي','تعاطف','ثقة سريعة'],
    tip:'الصراحة جميلة مع الناس… مو مع كل تطبيق.'},
  private:{emoji:'🔐',ar:'العقل الخاص',en:'THE PRIVATE MIND',
    desc:'حدودك واضحة. تفكر مرتين قبل ما تشارك أي معلومة، وتقرأ الصلاحيات قبل ما توافق. خصوصيتك خط أحمر.',
    traits:['حدود واضحة','وعي رقمي','حذر','استقلالية'],
    tip:'أنت الأقرب للأمان… بس حتى الحذرين يتسرب منهم شي أحيانًا.'},
  explorer:{emoji:'🔎',ar:'المستكشف الرقمي',en:'THE DIGITAL EXPLORER',
    desc:'فضولي وتحب التجربة! أول من يجرب التطبيقات الجديدة ويستخدم الذكاء الاصطناعي في كل شي. العالم الرقمي ملعبك.',
    traits:['فضول','سرعة تكيّف','تجربة دائمة','انفتاح تقني'],
    tip:'كل تطبيق تجربه يتعرف عليك… تأكد إنك تعرفه أنت كذلك.'},
  carrier:{emoji:'🛡️',ar:'الحامل الصامت',en:'THE SILENT CARRIER',
    desc:'قوي من برا، وتحمل الكثير من جوا. تفضّل تحتفظ بضغوطك لنفسك وتكمل. صلابتك ميزة… بس لا تنسَ إنك تستاهل مساحة آمنة.',
    traits:['صلابة','صبر','تحمّل','كتمان'],
    tip:'لما تحتاج تفضفض، اختر مساحة آمنة… مو أي تطبيق يسمع.'},
  routine:{emoji:'⏰',ar:'صانع الروتين',en:'THE ROUTINE KEEPER',
    desc:'منظّم ومستقر. يومك مرتب، نومك منتظم، وتستخدم التقنية لهدف واضح. الاستقرار قوتك… بس روتينك الثابت سهل التوقع.',
    traits:['تنظيم','انضباط','استقرار','وضوح أهداف'],
    tip:'الروتين الثابت = نمط يسهل على أي تطبيق توقّعه.'}
};

/* Each option: text, icon, type weights, and the insight it reveals */
const QUESTIONS=[
  {q:'لما تواجه ضغط كبير (امتحانات، مشاريع، مشاكل)… وش أول شي تسويه؟',dim:'أسلوبك مع الضغط',dimIcon:'📊',opts:[
    {t:'أفكر فيه كثير وأحلل كل الاحتمالات',i:'🌀',w:{overthinker:2},ins:'تميل للتفكير الزائد والتحليل تحت الضغط'},
    {t:'أتكلم مع أحد أو أكتب عنه',i:'💬',w:{openbook:2},ins:'تفرّغ ضغطك بالكلام والمشاركة'},
    {t:'أحتفظ به لنفسي وأكمل',i:'🛡️',w:{carrier:2,private:1},ins:'تحمل ضغطك بصمت وتفضّل عدم إظهاره'},
    {t:'أرتب جدول وأقسّم المهام',i:'📅',w:{routine:2},ins:'تواجه الضغط بالتنظيم والتخطيط'}]},
  {q:'صديق سألك: «كيف حالك فعلًا؟»… وش ردك؟',dim:'ارتياحك لمشاركة مشاعرك',dimIcon:'💜',opts:[
    {t:'أشاركه كل شي بصراحة',i:'🫶',w:{openbook:2},ins:'مرتاح جدًا بمشاركة مشاعرك مع الآخرين'},
    {t:'«تمام» وأغيّر الموضوع',i:'😶',w:{private:2,carrier:1},ins:'تفضّل إبقاء مشاعرك لنفسك'},
    {t:'أفكر كيف أصيغ الجواب أول',i:'🤔',w:{overthinker:2},ins:'تحسب كلامك قبل ما تعبّر عن مشاعرك'},
    {t:'أرسل له ميم يعبّر عن حالتي',i:'😂',w:{explorer:2},ins:'تعبّر عن مشاعرك بشكل رقمي وغير مباشر'}]},
  {q:'نزّلت تطبيق جديد وطلب صلاحيات (الموقع، جهات الاتصال، الميكروفون)…',dim:'حدودك في الخصوصية',dimIcon:'🔐',opts:[
    {t:'أوافق بسرعة، أبي أجرّب!',i:'⚡',w:{explorer:2},ins:'توافق على الصلاحيات بسرعة دون مراجعة'},
    {t:'أقرأ وش يطلب وأرفض الزايد',i:'🧐',w:{private:2},ins:'تراجع الصلاحيات بعناية وتحمي حدودك'},
    {t:'أوافق… بس أحس بقلق بعدها',i:'😬',w:{overthinker:2},ins:'توافق مع شعور بالقلق حول خصوصيتك'},
    {t:'أوافق على اللي أحتاجه لمهامي فقط',i:'✅',w:{routine:2,private:1},ins:'تمنح الصلاحيات حسب الحاجة الفعلية'}]},
  {q:'تستخدم تطبيقات الذكاء الاصطناعي (مثل ChatGPT) في…',dim:'سلوكك الرقمي مع الـ AI',dimIcon:'🤖',opts:[
    {t:'كل شي… حتى مشاعري ومشاكلي',i:'🗣️',w:{openbook:2,explorer:1},ins:'تشارك مشاعرك ومشاكلك الشخصية مع الـ AI'},
    {t:'الدراسة والمهام فقط',i:'📚',w:{routine:2},ins:'تستخدم الـ AI لأهداف محددة وعملية'},
    {t:'أجرّب فيه كل شي جديد',i:'🧪',w:{explorer:2},ins:'تستكشف الـ AI بفضول وتجرّب كل ميزة'},
    {t:'نادرًا… ما أثق فيه كثير',i:'🙅',w:{private:2,carrier:1},ins:'حذر من الـ AI ومحدود في استخدامه'}]},
  {q:'قبل النوم، عقلك عادةً…',dim:'روتينك ونومك',dimIcon:'🌙',opts:[
    {t:'يعيد أحداث اليوم ويفكر في بكرة',i:'💭',w:{overthinker:2},ins:'نومك يتأثر بالتفكير الزائد'},
    {t:'أتصفح الجوال لين أنام',i:'📱',w:{explorer:2},ins:'الجوال جزء من روتين نومك'},
    {t:'أحس بتعب مكتوم ما أتكلم عنه',i:'😮‍💨',w:{carrier:2},ins:'تحمل تعبًا نفسيًا لا تشاركه'},
    {t:'أنام بنفس الوقت تقريبًا كل يوم',i:'😴',w:{routine:2},ins:'روتين نوم منتظم وقابل للتوقع'}]},
  {q:'وش أكثر شي تخاف يعرفه الناس (أو التطبيقات) عنك؟',dim:'أكثر ما تحرص على حمايته',dimIcon:'🎯',opts:[
    {t:'ما عندي شي أخفيه صراحة',i:'🤷',w:{openbook:2},ins:'ما تحس إن عندك بيانات حساسة تستحق الحماية'},
    {t:'مشاعري الحقيقية',i:'💔',w:{carrier:2,overthinker:1},ins:'مشاعرك الحقيقية هي أكثر ما تحميه'},
    {t:'معلوماتي الشخصية ومكاني',i:'📍',w:{private:2,routine:1},ins:'تحمي معلوماتك الشخصية وموقعك'},
    {t:'كم ساعة أقضي على الجوال 😅',i:'⏳',w:{explorer:2},ins:'سلوكك الرقمي هو أكثر ما يحرجك'}]}
];

const $=s=>document.querySelector(s);
let idx=0,answers=[],score={};
const show=id=>{document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$(id).classList.add('active');scrollTo({top:0,behavior:'smooth'})};

function renderProgress(){$('#prog').innerHTML=QUESTIONS.map((_,i)=>`<span class="${i<idx?'done':i===idx?'now':''}"></span>`).join('')}
function renderQ(){
  const q=QUESTIONS[idx];renderProgress();
  const card=$('#qcard');card.style.animation='none';card.offsetHeight;card.style.animation='in .45s ease both';
  $('#qnum').textContent=`السؤال ${idx+1} من ${QUESTIONS.length}`;
  $('#qtext').textContent=q.q;
  $('#opts').innerHTML=q.opts.map((o,i)=>`<button class="opt fade-up d${i+1}" data-i="${i}"><span class="ic">${o.i}</span><span>${o.t}</span></button>`).join('');
  $('#opts').querySelectorAll('.opt').forEach(b=>b.onclick=()=>pick(+b.dataset.i,b));
}
function pick(i,btn){
  if(btn.classList.contains('picked'))return;
  btn.classList.add('picked');
  answers[idx]=i;
  const w=QUESTIONS[idx].opts[i].w;for(const k in w)score[k]=(score[k]||0)+w[k];
  setTimeout(()=>{idx++;idx<QUESTIONS.length?renderQ():analyze()},450);
}
function analyze(){
  show('#s-scan');
  const lines=['جارٍ تحليل إجاباتك…','قراءة أسلوبك مع الضغط 📊','تحليل سلوكك الرقمي 🤖','فحص حدود خصوصيتك 🔐','بناء ملفك الشخصي… 🧠'];
  let n=0;const t=setInterval(()=>{n++;if(n<lines.length)$('#scanline').textContent=lines[n];else{clearInterval(t);result()}},700);
}
function winner(){
  // tie-break by order of first strongest answer
  const order=Object.keys(TYPES);let best=null,bs=-1;
  for(const k of order){const s=score[k]||0;if(s>bs){bs=s;best=k}}
  return best;
}
function result(){
  const k=winner(),T=TYPES[k];
  $('#r-emoji').textContent=T.emoji;$('#r-title').textContent=T.ar;$('#r-en').textContent=T.en;
  $('#r-desc').textContent=T.desc;
  $('#r-traits').innerHTML=T.traits.map(t=>`<span class="trait">✦ ${t}</span>`).join('');
  show('#s-result');
}
function reveal(){
  show('#s-reveal');
  const items=QUESTIONS.map((q,i)=>({ic:q.dimIcon,dim:q.dim,ins:q.opts[answers[i]].ins}));
  $('#insights').innerHTML=items.map(it=>`<div class="ins"><span class="ic">${it.ic}</span><div><h4>${it.dim}</h4><p>${it.ins}</p></div></div>`).join('');
  $('#punch').style.opacity=0;
  document.querySelectorAll('.ins').forEach((el,i)=>setTimeout(()=>el.classList.add('show'),400+i*450));
  setTimeout(()=>{$('#punch').style.opacity=1;$('#punch').style.animation='in .7s ease both'},400+items.length*450+300);
}
$('#start').onclick=()=>{idx=0;answers=[];score={};renderQ();show('#s-quiz')};
$('#to-reveal').onclick=reveal;
$('#again').onclick=()=>show('#s-intro');
