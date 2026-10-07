/* ===== Protect Your Mind — Would You Share This? ===== */
const CHAT=[
  {ai:'أهلًا! كيف أقدر أساعدك اليوم؟',user:'صار لي فترة ما أنام كويس.',leak:['😴 نمط النوم','🧠 الحالة النفسية']},
  {ai:'آسف لسماع ذلك… هل في شي يشغل بالك؟',user:'أحس ضغط الجامعة مأثر عليّ.',leak:['🎓 وضعك الدراسي','💬 مخاوفك الشخصية']},
  {ai:'الضغط الدراسي صعب فعلًا. هل في شي ثاني يضايقك؟',user:'صار بيني وبين شخص قريب مني مشكلة…',leak:['❤️ علاقاتك الشخصية']},
  {ai:'أتفهم. متى تقدر تاخذ وقت لنفسك خلال اليوم؟',user:'أنا عادةً أكون في الجامعة من ٨ إلى ٤.',leak:['📍 روتينك اليومي','📍 مكانك المتوقع']},
];
const CARDS=[
  {ic:'🧠',en:'Emotional state',ar:'الحالة النفسية',d:'يمر بفترة تعب نفسي وقلق'},
  {ic:'😴',en:'Sleep pattern',ar:'نمط النوم',d:'يعاني من اضطراب نوم مستمر'},
  {ic:'🎓',en:'Student status',ar:'وضع الطالب',d:'طالب جامعي تحت ضغط دراسي'},
  {ic:'❤️',en:'Relationships',ar:'العلاقات الشخصية',d:'لديه خلاف مع شخص مقرّب'},
  {ic:'📍',en:'Daily routine',ar:'الروتين اليومي',d:'موجود في الجامعة من ٨ إلى ٤ يوميًا'},
  {ic:'💬',en:'Personal concerns',ar:'المخاوف الشخصية',d:'ما يقلقه وما يشغل تفكيره'},
];
const TF=[
  {q:'محادثاتك مع تطبيقات الذكاء الاصطناعي قد تُحفظ وتُستخدم لتحسين أو تدريب النماذج.',a:1,
   ok:'صح! كثير من التطبيقات تحتفظ بالمحادثات افتراضيًا… إلا إذا عطّلت ذلك من الإعدادات.',bad:'في الواقع، كثير من التطبيقات تحتفظ بالمحادثات وتستخدمها افتراضيًا إلا إذا عطّلت ذلك.'},
  {q:'إذا ما شاركت كلمة مرور أو رقم بطاقة، فمعلوماتي آمنة تمامًا.',a:0,
   ok:'صح، هذا خطأ شائع! مشاعرك وروتينك وعلاقاتك كلها بيانات حساسة ممكن تُستخدم في استهدافك.',bad:'للأسف لا. مشاعرك وروتينك ومكانك بيانات حساسة بحد ذاتها… حتى بدون كلمة مرور.'},
  {q:'الذكاء الاصطناعي يقدر يستنتج معلومات عنك ما قلتها صراحةً (مثل حالتك النفسية أو مكانك).',a:1,
   ok:'بالضبط! الاستنتاج هو قوة الذكاء الاصطناعي… ومن هنا تأتي الخطورة.',bad:'بل يقدر! من «أكون في الجامعة من ٨ إلى ٤» يستنتج مكانك ووقت غيابك عن البيت.'},
  {q:'مراجعة صلاحيات التطبيق وإعدادات الخصوصية مرة واحدة عند التثبيت تكفي.',a:0,
   ok:'صح، هذا خطأ! التطبيقات تحدّث سياساتها وتضيف صلاحيات… راجعها بشكل دوري.',bad:'التطبيقات تتغير وتضيف صلاحيات جديدة مع التحديثات. المراجعة الدورية ضرورية.'},
];

const $=s=>document.querySelector(s);
const show=id=>{document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$(id).classList.add('active');scrollTo({top:0,behavior:'smooth'})};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ci=0,ti=0,shareScore=0,tfScore=0;

function prog(el,total,at){el.innerHTML=Array.from({length:total},(_,i)=>`<span class="${i<at?'done':i===at?'now':''}"></span>`).join('')}
function bubble(role,html){const d=document.createElement('div');d.className='msg '+role;d.innerHTML=`<div class="av">${role==='ai'?'🤖':'🧑'}</div><div class="bubble">${html}</div>`;$('#chat').appendChild(d);d.scrollIntoView({behavior:'smooth',block:'nearest'});return d}

async function nextChat(){
  if(ci>=CHAT.length){await sleep(900);return toCards()}
  prog($('#prog'),CHAT.length,ci);
  const c=CHAT[ci];$('#ask').innerHTML='';
  const t=bubble('ai','<span class="typing"><span></span><span></span><span></span></span>');
  await sleep(900);t.querySelector('.bubble').textContent=c.ai;
  await sleep(600);
  const u=bubble('user','<span class="typing"><span></span><span></span><span></span></span>');
  await sleep(900);u.querySelector('.bubble').textContent=c.user;
  await sleep(300);
  $('#ask').innerHTML=`<div class="ask"><div class="q">👀 لو كنت مكانه… هل كنت بتشارك هذا مع تطبيق AI؟</div>
    <div class="row"><button class="choice yes" data-v="0">أشارك عادي 🤷</button><button class="choice" data-v="1">أتردّد 🤔</button><button class="choice no" data-v="2">ما أشارك 🙅</button></div></div>`;
  $('#ask').querySelectorAll('.choice').forEach(b=>b.onclick=()=>answerChat(+b.dataset.v,u));
}
function answerChat(v,u){
  shareScore+=v;$('#ask').innerHTML='';
  const leak=document.createElement('div');leak.className='leak'+(v===2?' ok':'');
  leak.innerHTML=(v===2?'🛡️ قرار حكيم! لكن هذه الرسالة كانت بتكشف: ':'⚠️ هذه الرسالة تكشف: ')+CHAT[ci].leak.join(' · ');
  u.after(leak);leak.style.alignSelf='flex-start';
  ci++;setTimeout(nextChat,1400);
}

let flipped=0;
function toCards(){
  show('#s-cards');flipped=0;
  $('#cards').innerHTML=CARDS.map((c,i)=>`<div class="flip d${i+1}" data-i="${i}"><div class="inner">
    <div class="face front">${c.ic}<small>${c.en}</small></div>
    <div class="face back"><b>${c.ar}</b><span>${c.d}</span></div></div></div>`).join('');
  $('#cards').querySelectorAll('.flip').forEach(f=>f.onclick=()=>{
    if(f.classList.contains('on'))return;f.classList.add('on');flipped++;
    if(flipped>=CARDS.length){setTimeout(()=>{$('#nopw').style.opacity=1;$('#nopw').style.animation='in .7s ease both';const b=$('#to-tf');b.disabled=false;b.style.opacity=1},500)}
  });
}

function renderTF(){
  prog($('#prog2'),TF.length,ti);
  const card=$('#tfcard');card.style.animation='none';card.offsetHeight;card.style.animation='in .45s ease both';
  $('#tfnum').textContent=`صح أو خطأ · ${ti+1} من ${TF.length}`;
  $('#tftext').textContent=TF[ti].q;$('#fb').innerHTML='';$('#nextwrap').style.display='none';
  card.querySelectorAll('.opt').forEach(b=>{b.classList.remove('picked');b.disabled=false;b.onclick=()=>{
    card.querySelectorAll('.opt').forEach(x=>x.disabled=true);b.classList.add('picked');
    const right=+b.dataset.v===TF[ti].a;if(right)tfScore++;
    $('#fb').innerHTML=`<div class="fb ${right?'good':'bad'}">${right?'🎉 ':'💡 '}${right?TF[ti].ok:TF[ti].bad}</div>`;
    $('#nextwrap').style.display='block';
  }});
}
$('#tfnext').onclick=()=>{ti++;ti<TF.length?renderTF():finish()};

function finish(){
  show('#s-result');
  const max=CHAT.length*2+TF.length*2;           // share choices (0-2) + TF (2 each)
  const pct=Math.round((shareScore+tfScore*2)/max*100);
  const L=pct>=80?['🛡️ عقل محمي','ممتاز! عندك وعي عالي بما تشاركه وتعرف إن مشاعرك وروتينك بيانات تستحق الحماية.']
        :pct>=50?['⚠️ عقل واعي… جزئيًا','لديك أساس جيد، لكن بعض المعلومات تتسرب منك دون قصد. طبّق القواعد الثلاث.']
        :['🔓 عقل مكشوف','تشارك أكثر مما تتصور! كل رسالة «بريئة» تضيف قطعة لصورتك الكاملة. وقت التغيير الآن.'];
  $('#level').textContent=L[0];$('#ldesc').textContent=L[1];
  let n=0;const step=()=>{if(n<pct){n++;$('#pct').textContent=n;requestAnimationFrame(step)}};
  setTimeout(()=>{$('#bar').style.strokeDashoffset=502-502*pct/100;step()},300);
}

$('#start').onclick=()=>{ci=0;ti=0;shareScore=0;tfScore=0;$('#chat').innerHTML='';$('#nopw').style.opacity=0;show('#s-chat');nextChat()};
$('#to-tf').onclick=()=>{ti=0;renderTF();show('#s-tf')};
$('#again').onclick=()=>show('#s-intro');
