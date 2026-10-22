// Three-line hierarchy: rounds/work/rest, blocks/rest if any, total.
const clock=sec=>String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
function countRu(n,one,few,many){const v=Math.abs(Number(n));return n+' '+(v%100>=11&&v%100<=14?many:v%10===1?one:v%10>=2&&v%10<=4?few:many);}
const rangeClock=(values,fallback=0)=>{
 const finite=values.filter(v=>Number.isFinite(v));
 if(!finite.length)return clock(fallback);
 const low=Math.min(...finite),high=Math.max(...finite);
 return clock(low)+(low===high?'':'–'+clock(high));
};
export function stageTimingRows(config,{total,rounds},english=false){
 if(config.intervalMode==='two_phase'){
  const extra=(config.ladderEnabled?(english?' · ladder':' · лестница'):'')+(rounds.some(r=>r.timingOverridden)?(english?' · custom':' · индивидуально'):'');
  return [
   ['program-stage-two-phase-meta',(english?rounds.length+' rounds · phase 1 ':countRu(rounds.length,'раунд','раунда','раундов')+' · фаза 1 ')+rangeClock(rounds.map(r=>r.workSec),config.workSec)+(english?' · phase 2 ':' · фаза 2 ')+rangeClock(rounds.map(r=>r.phaseTwoSec),config.phaseTwoSec||40)+(english?' · rest ':' · отдых ')+rangeClock(rounds.slice(0,-1).map(r=>r.restSec),config.restSec)+extra],
   ['program-stage-sum',(english?'Total: ':'Всего: ')+clock(total)]
  ];
 }
 const hasBlocks=(config.intervalMode==='ladder'||(config.intervalMode==='two_phase'&&config.ladderEnabled))&&Boolean(config.blockEnabled)&&Number(config.blockCount)>1;
 const count=hasBlocks?Number(config.rounds):rounds.length;
 const blocks=Number(config.blockCount);
 return [
  ['program-stage-count',english?count+' rounds':countRu(count,'раунд','раунда','раундов')],
  ['program-stage-work',(english?'work ':'работа ')+clock(config.workSec)],
  ['program-stage-rest',(english?'rest ':'отдых ')+clock(config.restSec)],
  ...(hasBlocks?[['program-stage-block-rest',(english?blocks+' blocks · between blocks ':countRu(blocks,'блок','блока','блоков')+' · отдых между блоками ')+clock(config.blockRestSec||0)]]:[]),
  ['program-stage-sum',(english?'Total: ':'Всего: ')+clock(total)]
 ];
}
