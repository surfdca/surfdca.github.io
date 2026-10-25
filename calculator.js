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
 return{T:T,t:keys,c:M.map(function(m){return m.c}),z:E.z,sma:E.sma,fill:E.fill,partial:keys[keys.length-1]===nowK,
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
function px(v){return '$'+(v>=100?v.toLocaleString('en-US',{maximumFractionDigits:0}):v>=1?v.toLocaleString('en-US',{maximumFractionDigits:2}):v.toPrecision(4))}
function qty(v){return v===0?'0':v>=1000?v.toLocaleString('en-US',{maximumFractionDigits:0}):v>=1?v.toLocaleString('en-US',{maximumFractionDigits:4}):v.toPrecision(5)}
function qtyT(v){return v>=1&&v<1000?v.toLocaleString('en-US',{minimumFractionDigits:4,maximumFractionDigits:4}):qty(v)}   /* table: fixed decimals keep the column even */
function first(c){for(var i=0;i<c.sma.length;i++)if(c.sma[i]!=null)return i;return 0}
function fillMonths(c){var s=$('scStart'),f=first(c),h='';   /* start resets to the coin's earliest month */
 for(var i=f;i<c.t.length;i++)h+='<option value="'+c.t[i]+'">'+lbl(c.t[i])+'</option>';s.innerHTML=h;
 s.value=c.t[f]}
function fail(){cur=null;$('scOut').hidden=true;$('scErr').textContent=FAIL}
function run(){
 var c=cur;if(!c)return;
 var t=c.T,z=c.z,amt=parseFloat($('scAmt').value),err=$('scErr');
 if(!(amt>=1&&amt<=1e9)){err.textContent='Enter an amount from $1 to $1,000,000,000.';$('scOut').hidden=true;return}
 err.textContent='';
 var s0=Math.max(first(c),c.t.indexOf($('scStart').value)),n=c.c.length,held=0,inv=0,rows=[],nb=0,i;
 for(i=s0;i<n;i++){var k=z[i],f=c.fill[i],p=f&&f.p;
  if(k==='b'){var q=amt/p;held+=q;inv+=amt;nb++;rows.push([i,f,qty(q)+' '+t,held])}}
 var last=c.c[n-1],val=held*last;
 $('scInv').textContent=usd(inv);$('scHeld').textContent=qty(held)+' '+t;
 $('scVal').textContent=usd(val);$('scValAt').textContent='at '+px(last)+(c.partial?', month in progress ('+dlbl(c.asOf)+')':', '+lbl(c.t[n-1])+' close');
 $('scSum').textContent=nb+' accumulation month'+(nb===1?'':'s')+' from '+nbsp(lbl(c.t[s0]))+' to '+nbsp(lbl(c.t[n-1]))+'.';
 var h='';rows.forEach(function(r){var cm=c.partial&&r[0]===n-1;
  h+='<tr><td>'+lbl(c.t[r[0]])+(cm?'*':'')+'</td><td>'+px(r[1].p)+'</td><td>'+r[2]+'</td><td>'+qtyT(r[3])+'</td></tr>'});
 $('scRows').innerHTML=h||'<tr><td colspan="4" class="emp">No accumulation months in this range.</td></tr>';
 $('scPart').hidden=!(rows.length&&c.partial&&rows[rows.length-1][0]===n-1);
 $('scWick').hidden=c.wicks;
 $('scOut').hidden=false}
function pick(){var T=$('scCoin').value;cur=null;$('scOut').hidden=true;$('scErr').textContent='';$('scLoad').hidden=false;
 load(T).then(function(c){if($('scCoin').value!==T)return;$('scLoad').hidden=true;cur=c;fillMonths(c);run()},
  function(){if($('scCoin').value!==T)return;$('scLoad').hidden=true;fail()})}
function init(){
 $('scCoin').innerHTML=Object.keys(COINS).map(function(t){return '<option>'+t+'</option>'}).join('');
 $('scCoin').addEventListener('change',pick);
 ['scStart','scAmt'].forEach(function(id){$(id).addEventListener('input',run);$(id).addEventListener('change',run)});
 $('scForm').addEventListener('submit',function(e){e.preventDefault();run()});pick()}
window.SurfDCA={engine:engine,load:load};   /* exposed for local checks only */
init();
})();
