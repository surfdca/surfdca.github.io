/* SurfDCA calculator. Loads price history live in the browser (no server, no key):
   - CoinMetrics community API: daily closes (PriceUSD), full history.
   - Binance public market data: monthly and weekly candles for highs/lows (from 2017/2019) and the current month's price so far.
   Zones are computed here with the Surf Indicator v5.3 monthly engine (surf_indicator_v5.3.pine, f_v48_monthlyZones). */
(function(){
'use strict';
var COINS={BTC:'btc',LTC:'ltc',DOGE:'doge'},MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var CM='https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?metrics=PriceUSD&frequency=1d&page_size=10000&assets=';
var BN='https://data-api.binance.vision/api/v3/klines?limit=1000&symbol=';
var FAIL="Price data couldn't load right now. Please try again later.";
var $=function(id){return document.getElementById(id)},CACHE={},cur=null;

/* ── data ─────────────────────────────────────────────── */
function getJSON(u){var a=new AbortController(),t=setTimeout(function(){a.abort()},20000);
 return fetch(u,{signal:a.signal}).then(function(r){clearTimeout(t);if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})}
function ymOf(ms){var d=new Date(ms);return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')}
function dayOf(ms){return new Date(ms).toISOString().slice(0,10)}
function monday(iso){var d=new Date(iso+'T00:00:00Z'),w=(d.getUTCDay()+6)%7;return dayOf(d.getTime()-w*864e5)}
function load(T){
 if(CACHE[T])return CACHE[T];
 var sym=T+'USDT',all=[];
 var cm=(function page(u){return getJSON(u).then(function(j){all=all.concat(j.data||[]);return j.next_page_url?page(j.next_page_url):all})})(CM+COINS[T]);
 var bm=getJSON(BN+sym+'&interval=1M').catch(function(){return null});
 var bw=getJSON(BN+sym+'&interval=1w').catch(function(){return null});
 return CACHE[T]=Promise.all([cm,bm,bw]).then(function(r){return build(T,r[0],r[1],r[2])}).catch(function(e){delete CACHE[T];throw e})}
function build(T,cm,bm,bw){
 var mon={},wk={},keys=[],wkeys=[];
 var prev=null;
 cm.forEach(function(r){var p=parseFloat(r.PriceUSD);if(!(p>0))return;var d=r.time.slice(0,10),k=d.slice(0,7),m=mon[k];
  if(!m){m=mon[k]={t:k,o:prev!=null?prev:p,c:p,l:p,h:p};keys.push(k)}prev=p;m.c=p;if(p<m.l)m.l=p;if(p>m.h)m.h=p;
  var s=monday(d),w=wk[s];if(!w){w=wk[s]={t:s,c:p,l:p};wkeys.push(s)}w.c=p;if(p<w.l)w.l=p});
 if(!keys.length)throw new Error('no data');
 var nowK=ymOf(Date.now()),live=null;
 if(bm&&bm.length){bm.forEach(function(k,j){var t=ymOf(k[0]),lo=+k[3],hi=+k[2],m=mon[t];
   if(!m){if(t!==nowK)return;m=mon[t]={t:t,o:+k[1],c:+k[4],l:lo,h:hi};keys.push(t)}
   if(j>0)m.o=+k[1];   /* month open = Binance monthly open (the listing month is partial, so it keeps the CoinMetrics open) */
   if(lo<m.l)m.l=lo;if(hi>m.h)m.h=hi});
  var lk=bm[bm.length-1];if(ymOf(lk[0])===nowK){mon[nowK].c=+lk[4];live=Date.now()}}   /* current month: latest price so far */
 if(bw&&bw.length)bw.forEach(function(k){var w=wk[dayOf(k[0])];if(w&&+k[3]<w.l)w.l=+k[3]});
 keys.sort();wkeys.sort();
 var M=keys.map(function(k){return mon[k]}),W=wkeys.map(function(k){return wk[k]}),E=engine(M,W);
 var lastDay=cm.length?cm[cm.length-1].time.slice(0,10):null;
 return{T:T,t:keys,o:M.map(function(m){return m.o}),c:M.map(function(m){return m.c}),z:E.z,sma:E.sma,fill:E.fill,partial:keys[keys.length-1]===nowK,
  asOf:live?dayOf(live):lastDay,wicks:!!(bm&&bm.length)}}

/* ── Surf Indicator v5.3 monthly zone engine (port of f_v48_monthlyZones) ── */
function sma(x,n){var o=[],s=0;for(var i=0;i<x.length;i++){s+=x[i];if(i>=n)s-=x[i-n];o.push(i>=n-1?s/n:null)}return o}
function rsi(x,n){var o=[],g=0,l=0;o[0]=null;   /* ta.rsi: Wilder RMA seeded with the SMA of the first n changes */
 for(var i=1;i<x.length;i++){var d=x[i]-x[i-1],u=d>0?d:0,v=d<0?-d:0;
  if(i<n){g+=u;l+=v;o[i]=null;continue}
  if(i===n){g=(g+u)/n;l=(l+v)/n}else{g=(g*(n-1)+u)/n;l=(l*(n-1)+v)/n}
  o[i]=l===0?100:g===0?0:100-100/(1+g/l)}return o}
function pivotLow(x,i,L,R){var c=i-R;if(c-L<0)return false;var v=x[c];if(v==null)return false;   /* ta.pivotlow: strictly below L left and R right bars */
 for(var j=c-L;j<=i;j++){if(j===c)continue;if(x[j]==null)return false;if(!(v<x[j]))return false}return true}
function engine(M,W){
 var C=M.map(function(m){return m.c}),n=C.length,S=sma(C,46),R=rsi(C,14),i,k;
 /* weekly bull divergence (Buy OR-leg): RSI pivots L=5 R=5, prior pivot 5..60 bars, higher RSI + lower low; p2 week mapped to its month */
 var WC=W.map(function(w){return w.c}),WR=rsi(WC,14),p2=[],cb=[],po=[],pl=[];
 for(i=0;i<W.length;i++){p2[i]=null;if(!pivotLow(WR,i,5,5))continue;var o=WR[i-5],lo=W[i-5].l,tt=W[i-5].t;
  for(k=cb.length-1;k>=0;k--){var bs=i-cb[k]-1;if(bs>60)break;if(bs>=5&&o>po[k]&&lo<pl[k]){p2[i]=tt;break}}
  cb.push(i);po.push(o);pl.push(lo)}
 var lastW={};W.forEach(function(w,j){lastW[w.t.slice(0,7)]=j});   /* value seen by the monthly bar = its last weekly bar */
 var conf=[],seen=null,wb=[];
 for(i=0;i<n;i++){var j=lastW[M[i].t];if(j!=null&&p2[j]!=null&&p2[j]!==seen){seen=p2[j];conf.push(p2[j])}
  wb[i]=conf.some(function(t){return t.slice(0,7)===M[i].t})}
 var z=[],fill=[];
 for(i=0;i<n;i++){var ok=S[i]!=null&&R[i]!=null,okp=i>0&&S[i-1]!=null&&R[i-1]!=null;
  var buyRaw=ok&&M[i].l<=S[i]&&(R[i]<=50||wb[i]);
  var buyPrev=okp&&C[i-1]<=S[i-1]&&R[i-1]<=50;
  var zz=buyRaw||buyPrev?'b':'n';z.push(zz);   /* accumulation zone only (buy-only calculator) */
  fill.push(zz==='b'?fillAt(M,C,S,i,buyPrev):null)}
 return{z:z,sma:S,fill:fill}}
/* Fill price. Carryover month (previous month closed in the zone): the month's open.
   Touch month: the price where it meets the live zone line. The live 46-month SMA includes the current price P, so the line is
   met where P = (sum of the previous 45 closes + P) / 46, i.e. P = sum45/45. If the month opens below that level, the touch
   is at the open. If the live level lies below the month's low (price never met it), the month's final SMA is used instead. */
function fillAt(M,C,S,i,carry){var m=M[i];if(carry)return{k:'Open',p:m.o};
 var s45=0;for(var j=i-45;j<i;j++)s45+=C[j];
 var L=s45/45;if(L<m.l)L=S[i];return{k:'Touch',p:Math.min(m.o,L)}}

/* ── calculator (unchanged rules) ─────────────────────── */
function lbl(k){return MON[+k.slice(5,7)-1]+' '+k.slice(0,4)}
function dlbl(d){return +d.slice(8,10)+'\u00a0'+MON[+d.slice(5,7)-1]+'\u00a0'+d.slice(0,4)}
function nbsp(s){return s.replace(/ /g,'\u00a0')}
function usd(v){var a=Math.abs(v);return (v<0?'−':'')+'$'+a.toLocaleString('en-US',{minimumFractionDigits:a>=1000?0:2,maximumFractionDigits:a>=1000?0:2})}
function px(v){return '$'+(v>=100?v.toLocaleString('en-US',{maximumFractionDigits:0}):v>=1?v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):v.toPrecision(4))}
var DEC={BTC:6,LTC:4,DOGE:0};   /* fixed decimals per coin keep the columns even */
function qty(v,t){var d=DEC[t];if(d==null)d=4;return v.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d})}
function pct(v){var a=Math.abs(v)*100,s=a.toLocaleString('en-US',{minimumFractionDigits:a>=100?0:1,maximumFractionDigits:a>=100?0:1});   /* whole % from 100%, one decimal below */
 if(s==='0'||s==='0.0')return '0%';return (v>0?'+':'−')+s+'%'}
function setPct(el,v){el.textContent=pct(v);el.className='scret'+(pct(v)==='0%'?'':v>0?' up':' dn')}
function first(c){var i,f=0;for(i=0;i<c.sma.length;i++)if(c.sma[i]!=null){f=i;break}
 for(i=f;i<c.z.length;i++)if(c.z[i]==='b')return i;return f}   /* first accumulation month; zones still use the full history */
function fillMonths(c){var s=$('scStart'),f=first(c),h='';   /* start resets to the coin's first accumulation month */
 for(var i=f;i<c.t.length;i++)h+='<option value="'+c.t[i]+'">'+lbl(c.t[i])+'</option>';s.innerHTML=h;
 s.value=c.t[f]}
function fail(){cur=null;$('scOut').hidden=$('scPer').hidden=true;$('scErr').textContent=FAIL}
function plot(c,f,s0,buys,W,H,k){   /* shared chart geometry: monthly close, log scale; blue columns = accumulation months, dots = buys from the chosen start */
 var n=c.t.length,L,R=6*k,T=6*k,B=18*k,i,o={W:W,H:H,k:k,z:[],g:[],x:[],p:[],d:[]};
 var lo=Infinity,hi=-Infinity;for(i=f;i<n;i++){lo=Math.min(lo,c.c[i]);hi=Math.max(hi,c.c[i])}
 var l0=Math.log10(lo),l1=Math.log10(hi),m=(l1-l0)*.06||.1;l0-=m;l1+=m;
 var ticks=[],e;for(e=Math.floor(l0);e<=Math.ceil(l1);e++)[1,2,5].forEach(function(q){var v=q*Math.pow(10,e),y=Math.log10(v);if(y>l0&&y<l1)ticks.push([v,q])});
 if(ticks.length>4)ticks=ticks.filter(function(v){return v[1]===1});
 var tl=function(v){return v>=1?'$'+v.toLocaleString('en-US'):'$'+(+v.toPrecision(1))};L=(8+5.6*Math.max(3,Math.max.apply(null,ticks.map(function(v){return tl(v[0]).length}))))*k;
 var dx=(W-L-R)/(n-f-1),X=function(i){return L+(i-f)*dx},Y=function(v){return T+(l1-Math.log10(v))/(l1-l0)*(H-T-B)};
 o.L=L;o.R=W-R;o.T=T;o.B=H-B;
 for(i=f;i<n;i++)if(c.z[i]==='b'){var a=Math.max(L,X(i)-dx/2);o.z.push([a,Math.min(X(i)+dx/2,W-R)-a,i<s0?.08:.2])}
 ticks.forEach(function(v){if(Y(v[0])>=10*k)o.g.push([Y(v[0]),tl(v[0])])});
 var st=[1,2,3,5,10].filter(function(q){return q*dx*12>=34*k})[0]||10;
 for(i=f;i<n;i++){if(c.t[i].slice(5)==='01'&&+c.t[i].slice(0,4)%st===0&&X(i)>=L+10*k&&X(i)<=W-14*k)o.x.push([X(i),c.t[i].slice(0,4)]);o.p.push([X(i),Y(c.c[i])])}
 buys.forEach(function(i){o.d.push([X(i),Y(c.c[i])])});return o}
function chart(c,f,s0,buys){
 var box=$('scCh'),n=c.t.length;box.hidden=n-f<2;if(box.hidden)return;
 var W=Math.max(240,Math.round($('scChS').clientWidth||box.clientWidth-18)),H=W<480?150:190,o=plot(c,f,s0,buys,W,H,1),h='',r1=function(v){return Math.round(v*10)/10};
 o.z.forEach(function(z){h+='<rect x="'+r1(z[0])+'" y="'+o.T+'" width="'+r1(z[1])+'" height="'+(o.B-o.T)+'" fill="#3d9bff" fill-opacity="'+z[2]+'"/>'});
 o.g.forEach(function(g){var y=r1(g[0]);h+='<line x1="'+r1(o.L)+'" x2="'+o.R+'" y1="'+y+'" y2="'+y+'" stroke="#1c2f4d"/><text x="'+r1(o.L-4)+'" y="'+r1(y+3.5)+'" text-anchor="end">'+g[1]+'</text>'});
 o.x.forEach(function(x){h+='<text x="'+r1(x[0])+'" y="'+(H-4)+'" text-anchor="middle">'+x[1]+'</text>'});
 h+='<polyline points="'+o.p.map(function(p){return r1(p[0])+','+r1(p[1])}).join(' ')+'" fill="none" stroke="#c9d6e6" stroke-width="1.5" stroke-linejoin="round"/>';
 $('scChB').hidden=!buys.length;
 o.d.forEach(function(d){h+='<circle cx="'+r1(d[0])+'" cy="'+r1(d[1])+'" r="2.6" fill="#3d9bff" stroke="#0d1a2e" stroke-width="1"/>'});
 $('scChS').innerHTML='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+c.T+' monthly price, log scale, '+lbl(c.t[f])+' to '+lbl(c.t[n-1])+'" font-size="10" fill="#5f7593">'+h+'</svg>'}
var shr=null,FONT='system-ui,-apple-system,"Segoe UI",Roboto,Inter,sans-serif';
function card(s){   /* 1200x675 share image, drawn locally on a canvas */
 var cv=document.createElement('canvas'),x=cv.getContext('2d'),W=1200,H=675,P=56,c=s.c;cv.width=W;cv.height=H;
 var g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'#0c1a30');g.addColorStop(1,'#0a1424');x.fillStyle=g;x.fillRect(0,0,W,H);
 var F=function(w,z){x.font=w+' '+z+'px '+FONT},T=function(t,X,Y,col,al){x.fillStyle=col;x.textAlign=al||'left';x.fillText(t,X,Y)};
 var rr=function(X,Y,w,h,r,fill,line){x.beginPath();x.moveTo(X+r,Y);x.arcTo(X+w,Y,X+w,Y+h,r);x.arcTo(X+w,Y+h,X,Y+h,r);x.arcTo(X,Y+h,X,Y,r);x.arcTo(X,Y,X+w,Y,r);x.closePath();x.fillStyle=fill;x.fill();x.lineWidth=2;x.strokeStyle=line;x.stroke()};
 x.textBaseline='alphabetic';
 F(700,46);T(c.T+' from '+lbl(c.t[s.fb]),P,P+42,'#e7eef7');
 F(400,24);T('Budget '+usd(s.inv)+' · value now',P,P+82,'#8ba0bb');
 F(400,20);var lx=W-P;T('Buy',lx,P+80,'#8ba0bb','right');lx-=x.measureText('Buy').width+10;x.fillStyle='#3d9bff';x.beginPath();x.arc(lx-6,P+73,6,0,7);x.fill();
 lx-=32;T('Accumulation zone',lx,P+80,'#8ba0bb','right');lx-=x.measureText('Accumulation zone').width+10;x.fillStyle='rgba(61,155,255,.35)';x.fillRect(lx-16,P+64,16,16);
 var bw=(W-2*P-24)/2,by=P+112,bh=118;
 [['SurfDCA · accumulation months',s.val,'#3d9bff'],['Monthly DCA · fixed amount',s.pv,'#1c2f4d']].forEach(function(b,j){
  var bx=P+j*(bw+24),v=b[1],r=(v-s.inv)/s.inv,q=pct(r),col=q==='0%'?'#8ba0bb':r>0?'#34d27b':'#ff6161';
  rr(bx,by,bw,bh,14,'#0d1a2e',b[2]);F(400,22);T(b[0],bx+24,by+38,'#8ba0bb');
  var z=48,u=usd(v);for(;z>28;z-=2){F(700,z);var w1=x.measureText(u).width;F(700,z*.62);if(w1+16+x.measureText(q).width<=bw-48)break}
  F(700,z);T(u,bx+24,by+94,'#e7eef7');var w2=x.measureText(u).width;F(700,Math.round(z*.62));T(q,bx+24+w2+16,by+94,col)});
 var cy=by+bh+24,ch=H-cy-64;rr(P,cy,W-2*P,ch,14,'#0d1a2e','#1c2f4d');
 var o=plot(c,s.f,s.s0,s.buys,W-2*P-32,ch-32,1.9),ox=P+16,oy=cy+16;x.save();x.translate(ox,oy);
 o.z.forEach(function(z){x.fillStyle='rgba(61,155,255,'+z[2]+')';x.fillRect(z[0],o.T,z[1],o.B-o.T)});
 F(400,19);x.lineWidth=1.5;o.g.forEach(function(q){x.strokeStyle='#1c2f4d';x.beginPath();x.moveTo(o.L,q[0]);x.lineTo(o.R,q[0]);x.stroke();T(q[1],o.L-8,q[0]+7,'#5f7593','right')});
 o.x.forEach(function(q){T(q[1],q[0],o.H-7,'#5f7593','center')});
 x.strokeStyle='#c9d6e6';x.lineWidth=2.6;x.lineJoin='round';x.beginPath();o.p.forEach(function(p,i){i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])});x.stroke();
 o.d.forEach(function(d){x.beginPath();x.arc(d[0],d[1],4.6,0,7);x.fillStyle='#3d9bff';x.fill();x.lineWidth=2;x.strokeStyle='#0d1a2e';x.stroke()});x.restore();
 F(600,20);T('surfdca.github.io',P,H-26,'#8ba0bb');F(400,17);T('Educational. Not financial advice.',W-P,H-26,'#5f7593','right');return cv}
function share(){if(!shr)return;var s=shr,u=card(s).toDataURL('image/png'),b=atob(u.split(',')[1]),a=new Uint8Array(b.length);   /* sync, so the tap still counts for the share sheet */
 for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);var name=('surfdca-'+s.c.T+'-'+lbl(s.c.t[s.fb]).replace(' ','-')+'.png').toLowerCase(),bl=new Blob([a],{type:'image/png'});
 var dl=function(){var l=document.createElement('a'),h=URL.createObjectURL(bl);l.href=h;l.download=name;document.body.appendChild(l);l.click();l.remove();setTimeout(function(){URL.revokeObjectURL(h)},4000)};
 try{var fl=new File([bl],name,{type:'image/png'});if(navigator.canShare&&matchMedia('(pointer:coarse)').matches&&navigator.canShare({files:[fl]})){navigator.share({files:[fl],title:'SurfDCA'}).catch(function(e){if(e&&e.name!=='AbortError')dl()});return}}catch(e){}
 dl()}
function fit(){[].forEach.call(document.querySelectorAll('.scr dd'),function(d){d.style.fontSize='';var s=parseFloat(getComputedStyle(d).fontSize);   /* shrink a long figure to one line instead of wrapping */
 while(d.scrollWidth>d.clientWidth+.5&&s>12){s--;d.style.fontSize=s+'px'}})}
function run(){

 var c=cur;if(!c)return;
 var t=c.T,z=c.z,B=parseFloat($('scAmt').value),err=$('scErr');
 if(!(B>=1&&B<=1e9)){err.textContent='Enter a budget from $1 to $1,000,000,000.';$('scOut').hidden=true;$('scPer').hidden=true;return}
 err.textContent='';
 var s0=Math.max(first(c),c.t.indexOf($('scStart').value)),n=c.c.length,held=0,inv=0,rows=[],nb=0,fb=-1,i;
 for(i=s0;i<n;i++)if(z[i]==='b')nb++;   /* the budget is split evenly over the buy months in range */
 var amt=nb?B/nb:0;nb=0;
 for(i=s0;i<n;i++){var k=z[i],f=c.fill[i],p=f&&f.p;
  if(k==='b'){var q=amt/p;held+=q;inv+=amt;nb++;rows.push([i,f,qty(q,t),held]);if(fb<0)fb=i}}
 if(nb)inv=B;   /* exact, no float drift from summing */
 var last=c.c[n-1],val=held*last;
 $('scPer').hidden=!nb;if(nb)$('scPer').textContent='$'+amt.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' per accumulation month';
 $('scInv').textContent=usd(inv);$('scHeld').textContent=qty(held,t)+' '+t;
 $('scVal').textContent=usd(val);$('scRet').hidden=!inv;if(inv)setPct($('scRet'),(val-inv)/inv);
 /* monthly DCA: the same budget split evenly over every month from the first buy through the current month, bought at the open */
 var ph=0,pi=0,pv=0;if(fb>=0){var pm=B/(n-fb);for(i=fb;i<n;i++)ph+=pm/c.o[i];pi=B}
 $('scPlain').hidden=$('scPlainN').hidden=!pi;if(pi){   /* equal capital: the same total, spread evenly over every month from the first buy */
  pv=ph*last;$('scCapAmt').textContent=usd(inv);$('scPlainM').textContent=nbsp(lbl(c.t[fb]))+':';
  $('scCapZ').textContent=usd(val);setPct($('scCapZR'),(val-inv)/inv);$('scCapP').textContent=usd(pv);setPct($('scPlainR'),(pv-inv)/inv)}
 $('scValAt').textContent='at '+px(last)+(c.partial?', month in progress ('+dlbl(c.asOf)+')':', '+lbl(c.t[n-1])+' close');
 $('scSum').textContent=nb?nb+' accumulation month'+(nb===1?'':'s')+' from '+nbsp(lbl(c.t[fb]))+' to\u00a0'+nbsp(lbl(c.t[n-1]))+'.':s0===n-1?'No accumulation months since '+nbsp(lbl(c.t[s0]))+'.':'No accumulation months from '+nbsp(lbl(c.t[s0]))+' to\u00a0'+nbsp(lbl(c.t[n-1]))+'.';
 var h='';rows.forEach(function(r){var cm=c.partial&&r[0]===n-1;
  h+='<tr><td>'+lbl(c.t[r[0]])+(cm?'*':'')+'</td><td>'+px(r[1].p)+'</td><td>'+r[2]+'</td><td>'+qty(r[3],t)+'</td></tr>'});
 $('scRows').innerHTML=h||'<tr><td colspan="4" class="emp">No accumulation months in this range.</td></tr>';
 $('scPart').hidden=!(rows.length&&c.partial&&rows[rows.length-1][0]===n-1);
 $('scWick').hidden=c.wicks;
 $('scOut').hidden=false;fit();var bs=rows.map(function(r){return r[0]});chart(c,first(c),s0,bs);
 shr=pi?{c:c,f:first(c),s0:s0,fb:fb,buys:bs,inv:inv,val:val,pv:pv}:null;$('scShare').hidden=!shr}
function pick(){var T=$('scCoin').value;cur=null;$('scOut').hidden=$('scPer').hidden=true;$('scErr').textContent='';$('scLoad').hidden=false;
 load(T).then(function(c){if($('scCoin').value!==T)return;$('scLoad').hidden=true;cur=c;fillMonths(c);run()},
  function(){if($('scCoin').value!==T)return;$('scLoad').hidden=true;fail()})}
function init(){
 $('scCoin').innerHTML=Object.keys(COINS).map(function(t){return '<option>'+t+'</option>'}).join('');
 $('scCoin').addEventListener('change',pick);
 ['scStart','scAmt'].forEach(function(id){$(id).addEventListener('input',run);$(id).addEventListener('change',run)});
 var rw;window.addEventListener('resize',function(){clearTimeout(rw);rw=setTimeout(run,150)});
 $('scShare').addEventListener('click',share);
 $('scForm').addEventListener('submit',function(e){e.preventDefault();run()});pick()}
window.SurfDCA={engine:engine,load:load};   /* exposed for local checks only */
init();
})();
