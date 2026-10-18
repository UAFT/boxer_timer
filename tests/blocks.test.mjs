import test from 'node:test';
import assert from 'node:assert/strict';
import {totalRoundsForConfig,workSecForRound,restSecAfterRound,totalDurationSecForConfig} from '../app/js/core/schedule.js';
test('repeated ladder blocks',()=>{
 const c={intervalMode:'ladder',rounds:3,workSec:60,workStepSec:-20,restSec:30,blockEnabled:true,blockCount:3,blockRestSec:90};
 assert.equal(totalRoundsForConfig(c),9);
 assert.deepEqual(Array.from({length:9},(_,i)=>workSecForRound(c,i+1)),[60,40,20,60,40,20,60,40,20]);
 assert.equal(restSecAfterRound(c,3),90);
 assert.equal(restSecAfterRound(c,6),90);
 assert.equal(totalDurationSecForConfig(c),720);
});
