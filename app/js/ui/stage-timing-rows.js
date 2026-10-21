// Three-line hierarchy: rounds/work/rest, blocks/rest if any, total.
const clock=sec=>String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
function countRu(n,one,few,many){const v=Math.abs(Number(n));return n+' '+(v%100>=11&&v%100<=14?many:v%10===1?one:v%10>=2&&v%10<=4?few:many);}
export function stageTimingRows(config,{total,rounds},english=false){
 if(config.intervalMode==='two_phase'){
  return [
   ['program-stage-two-phase-meta',(english?rounds.length+' rounds · phase 1 ':countRu(rounds.length,'раунд','раунда','раундов')+' · фаза 1 ')+clock(config.workSec)+(english?' · phase 2 ':' · фаза 2 ')+clock(config.phaseTwoSec||40)+(english?' · rest ':' · отдых ')+clock(config.restSec)],
   ['program-stage-sum',(english?'Total: ':'Всего: ')+clock(total)]
  ];
 }
 const hasBlocks=config.intervalMode==='ladder'&&Boolean(config.blockEnabled)&&Number(config.blockCount)>1;
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
