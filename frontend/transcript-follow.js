export function createTranscriptFollower(panel,timeline,button){
  let following=true,frame=null,userUntil=0,lastTop=panel.scrollTop;
  const nearBottom=()=>panel.scrollHeight-panel.scrollTop-panel.clientHeight<48;
  const updateButton=()=>{button.hidden=following||nearBottom();};
  const schedule=()=>{
    if(frame!==null)return;
    frame=requestAnimationFrame(()=>{frame=null;if(following)panel.scrollTop=panel.scrollHeight;lastTop=panel.scrollTop;updateButton();});
  };
  const gesture=()=>{userUntil=performance.now()+1200;};
  panel.addEventListener('wheel',event=>{gesture();if(event.deltaY<0)following=false;},{passive:true});
  panel.addEventListener('touchstart',gesture,{passive:true});
  panel.addEventListener('pointerdown',gesture);
  panel.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key)){gesture();if(['ArrowUp','PageUp','Home'].includes(event.key))following=false;}});
  panel.addEventListener('scroll',()=>{
    if(performance.now()<userUntil){following=nearBottom();}
    else if(nearBottom()&&panel.scrollTop>lastTop)following=true;
    lastTop=panel.scrollTop;updateButton();
  },{passive:true});
  button.onclick=()=>{following=true;userUntil=0;schedule();};
  const resize=new ResizeObserver(schedule);resize.observe(panel);resize.observe(timeline);
  return {
    refresh(changed=false){if(changed){following=true;userUntil=0;}schedule();},
    submit(){following=true;userUntil=0;schedule();},
    get following(){return following;},
  };
}
