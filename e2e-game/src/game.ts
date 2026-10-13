export type Organ = {id:string;name:string; x:number;y:number;w:number;h:number;hint:string;layer:number};
// Coordinates in an anterior projection, normalized to the whole skeleton image.
// Patient's right appears on the viewer's left. Paired organs are one game piece.
export const ORGANS: Organ[] = [
{id:'deltoid',name:'Left Shoulder Muscle',x:25,y:21,w:13,h:7,layer:12,hint:'I help lift the arm out to the side and cover the rounded joint at its top.'},
{id:'forearm',name:'Right Forearm Muscles',x:83,y:39,w:9,h:13,layer:12,hint:'I help bend the wrist and curl the fingers, working between the elbow and hand.'},
{id:'tibialis',name:'Left Shin Muscle',x:36,y:83,w:8,h:16,layer:12,hint:'I lift the toes toward the knee so they clear the ground as you walk.'},
{id:'adductors',name:'Left Inner Thigh Muscles',x:42,y:61,w:10,h:14,layer:12,hint:'I draw the legs toward each other and help steady you when changing direction.'},
{id:'spleen',name:'Spleen',x:63,y:33,w:9,h:5,layer:7,hint:'I help filter blood and support immune defenses, tucked beside the stomach under the lower ribs.'},
{id:'brain',name:'Brain',x:50,y:6.9,w:21.5,h:9.7,layer:10,hint:'I coordinate memory, movement and thought. Bone surrounds me on every side.'},
{id:'heart',name:'Heart',x:51.6,y:24.5,w:21.3,h:7,layer:8,hint:'I pump blood all day. My protective cage also expands when you breathe.'},
{id:'lungs',name:'Lungs',x:50,y:26.6,w:38.8,h:13.1,layer:3,hint:'My two halves exchange gases, leaving room between them for a tireless pump.'},
{id:'liver',name:'Liver',x:43,y:32.3,w:38,h:9.9,layer:5,hint:'I process nutrients and make bile. Most of me sits on the body’s right, sheltered by lower ribs.'},
{id:'stomach',name:'Stomach',x:55.9,y:32.4,w:20.7,h:6.9,layer:7,hint:'I churn a meal after it travels down a muscular tube. I am tucked beneath the breathing muscle.'},
{id:'kidneys',name:'Kidneys',x:50.2,y:36.4,w:27.5,h:7.2,layer:2,hint:'I filter blood as a pair, closer to the back than the front, on either side of the spine.'},
{id:'pancreas',name:'Pancreas',x:51.9,y:35.7,w:18.6,h:4.3,layer:8,hint:'I help control blood sugar and digest food. I lie across the body, behind the organ that churns meals.'},
{id:'glutes',name:'Glutes',x:50,y:49,w:33,h:11,layer:12,hint:'I power the movement that takes you from sitting to standing and help keep your hips steady.'},
{id:'intestines',name:'Intestines',x:49.3,y:42.8,w:37.7,h:18.7,layer:4,hint:'My long folded passage absorbs nutrients and water. I need the roomy space below the main digestive organs.'},
{id:'bladder',name:'Bladder',x:50,y:51.2,w:12,h:5.5,layer:9,hint:'I store liquid waste until you are ready to release it. A ring of hip bones protects me.'},
{id:'triceps',name:'Left Tricep',x:22,y:28.5,w:11,h:11,layer:12,hint:'I straighten the elbow when you push something away. I work opposite the muscle that curls the arm.'},
{id:'thyroid',name:'Thyroid',x:50,y:17,w:10,h:3,layer:9,hint:'My butterfly shape wraps around an air passage. My hormones help set the pace of metabolism.'},
{id:'trachea',name:'Trachea',x:50,y:20.3,w:12,h:9,layer:5,hint:'Cartilage rings keep me open as air travels through me. I divide into two branches.'},
{id:'esophagus',name:'Esophagus',x:50.5,y:25.1,w:5.5,h:16,layer:1,hint:'Waves of muscle move swallowed food through me. I run behind the airway toward a digestive pouch.'},
{id:'hamstrings',name:'Left Hamstring',x:34,y:63,w:15,h:19,layer:12,hint:'I bend the knee and help drive the leg backward when you run. I work opposite the thigh muscles that straighten the knee.'},
{id:'biceps',name:'Right Bicep',x:78,y:28.5,w:10,h:10,layer:12,hint:'I bend the elbow and help turn the palm upward. Look for a long bone between two arm joints.'},
{id:'eyes',name:'Eyes',x:50,y:9.1,w:12,h:2.6,layer:11,hint:'I turn light into signals. Two bony sockets protect this pair.'},
{id:'tongue',name:'Tongue',x:50,y:12.5,w:6.5,h:2.5,layer:12,hint:'I help with taste, speech and the first part of swallowing. I work within an opening in the face.'},
{id:'quadriceps',name:'Right Quadriceps',x:66,y:64,w:15,h:20,layer:12,hint:'I straighten the knee and help you rise from a chair. I am a powerful group on the front of a leg.'},
{id:'calves',name:'Calf muscles',x:64,y:83,w:11,h:17,layer:12,hint:'I lift the heel when you stand on tiptoe. My tendon reaches down toward the back of the foot.'},
];
// Elapsed milliseconds since the round began or the previous successful match.
// Thresholds are inclusive; errors and selection changes do not reset the window.
export function pointsForMatch(elapsedMs:number){
 if(elapsedMs<=15000)return 5;
 if(elapsedMs<=25000)return 4;
 if(elapsedMs<=35000)return 3;
 if(elapsedMs<=60000)return 2;
 return 1;
}
export function isCorrect(organ:Organ,x:number,y:number){
 // Elliptical, organ-specific tolerances. Small structures stay playable at full-body scale.
 const rx=Math.max(organ.w*.42,7), ry=Math.max(organ.h*.3,2.1);
 return ((x-organ.x)/rx)**2+((y-organ.y)/ry)**2<=1;
}
export function shuffled<T>(values:T[]):T[]{const out=[...values];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}

// Version new sprites so live pages retry images requested before generation completed.
export const organAsset=(id:string)=>`/assets/organs/${id}.webp${['hamstrings','triceps','glutes'].includes(id)?'?v=2':''}`;

export const placementSide=(id:string):'front'|'back'=>['kidneys','glutes','triceps','hamstrings','calves'].includes(id)?'back':'front';
