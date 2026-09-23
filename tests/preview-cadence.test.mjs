import test from 'node:test';
import assert from 'node:assert/strict';
import {previewCheckpointDue,modificationCount} from '../frontend/preview-cadence.js';
test('only authorized submitted modifications trigger a single preview checkpoint',()=>{
 const flow={trigger:'adjust',baseVersionId:'v1',history:['pause','area','question','confirm','question'].map(kind=>({node:{kind}}))};
 assert.equal(modificationCount(flow),3);assert(!previewCheckpointDue({},flow));assert(previewCheckpointDue({previewEvery:3},flow));
 for(const patch of [{previewCheckpoint:true},{pendingId:'.pending-v2'},{baseVersionId:null},{trigger:'failure'},{previewStartCount:1}])assert(!previewCheckpointDue({previewEvery:3},{...flow,...patch}));
 assert(!previewCheckpointDue({previewEvery:2},flow));
});
