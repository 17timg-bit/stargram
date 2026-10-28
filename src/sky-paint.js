/* Deterministic astronomical motifs, drawn once into cached textures. */
(function(root){
  'use strict';
  function paint(c,w,h,raw,strength=1){
    const A=AstroAppearance,r=A.validate(raw),s=A.catalogs.sky[r.sky];
    let seed=7391;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    c.save();c.fillStyle=s.base;c.fillRect(0,0,w,h);
    function glow(x,y,size,color,alpha){c.save();c.globalAlpha=alpha*strength;const g=c.createRadialGradient(x,y,0,x,y,size);g.addColorStop(0,color);g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(x-size,y-size,size*2,size*2);c.restore();}
    const unit=Math.min(w,h);
    if(r.sky==='rosette'){
      for(let n=0;n<60;n++){const a=n/60*Math.PI*2,ring=unit*(.23+rand()*.10);glow(w*.68+Math.cos(a)*ring,h*.42+Math.sin(a)*ring*.8,unit*(.08+rand()*.1),s.colors[n%2],.12);}
      for(let n=0;n<13;n++){const a=rand()*6.28;glow(w*.68+Math.cos(a)*unit*.22,h*.42+Math.sin(a)*unit*.17,unit*.08,s.base,.65);}
    }else if(r.sky==='pleiades'){
      const group=[[.50,.22],[.58,.38],[.72,.30],[.79,.48],[.63,.56],[.45,.50],[.83,.25]];
      group.forEach(([x,y],i)=>{glow(w*x,h*y,unit*.22,s.colors[i%2],.25);glow(w*x,h*y,unit*.045,'#b8dcff',.6);c.save();c.strokeStyle='#b8dcff';c.globalAlpha=.36*strength;c.lineWidth=.7;c.beginPath();c.moveTo(w*x-12,h*y);c.lineTo(w*x+12,h*y);c.moveTo(w*x,h*y-12);c.lineTo(w*x,h*y+12);c.stroke();c.restore();});
      c.save();c.strokeStyle=s.colors[0];c.lineWidth=unit*.014;c.globalAlpha=.08*strength;for(let n=0;n<25;n++){const y=h*(.15+n*.025);c.beginPath();c.moveTo(w*.38,y);c.bezierCurveTo(w*.55,y+h*.20,w*.70,y-h*.16,w*.9,y+h*.1);c.stroke();}c.restore();
    }else if(r.sky==='aurora'){
      c.save();for(let n=0;n<55;n++){const x=w*(.22+n*.014),y=h*(.25+Math.sin(n*.11)*.13);const g=c.createLinearGradient(0,y,0,h*.86);g.addColorStop(0,s.colors[1]+'00');g.addColorStop(.35,s.colors[0]);g.addColorStop(1,s.colors[0]+'00');c.strokeStyle=g;c.globalAlpha=.13*strength;c.lineWidth=w*.025;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x-w*.10,h*.50,x+w*.08,h*.60,x-w*.10,h*.9);c.stroke();}c.restore();
    }else if(r.sky==='moon'){
      glow(w*.72,h*.38,unit*.40,'#a4a9ba',.24);
      c.save();for(let n=0;n<68;n++){const x=w*(.42+rand()*.6),y=h*rand(),rad=unit*(.006+rand()*.06);c.globalAlpha=(.025+rand()*.04)*strength;c.fillStyle=s.colors[n%2];c.strokeStyle=s.ink;c.lineWidth=Math.max(.6,rad*.06);c.beginPath();c.arc(x,y,rad,0,6.284);c.fill();c.stroke();}c.restore();
    }else if(r.sky==='zodiac'){
      c.save();c.translate(w*.72,h*.65);c.rotate(-.65);const g=c.createLinearGradient(-w*.45,0,w*.45,0);g.addColorStop(0,s.colors[0]+'00');g.addColorStop(.5,s.colors[0]);g.addColorStop(1,s.colors[0]+'00');c.globalAlpha=.2*strength;c.fillStyle=g;c.fillRect(-w*.7,-h*.08,w*1.4,h*.16);c.restore();glow(w*.76,h*.73,unit*.55,s.colors[1],.12);
    }else{
      for(let n=0;n<38;n++){const x=w*(.18+n*.019),y=h*(.90-n*.016)+Math.sin(n)*h*.05;glow(x,y,unit*(.07+rand()*.09),s.colors[n%2],.075);}
    }
    if(!s.light){c.save();for(let n=0;n<210;n++){c.globalAlpha=(.10+rand()*.35)*strength;c.fillStyle=n%13?'#d8dfeb':s.colors[0];c.beginPath();c.arc(rand()*w,rand()*h,.35+rand()*.8,0,6.284);c.fill();}c.restore();}
    // A quiet left margin keeps small editing text readable on every sky.
    const veil=c.createLinearGradient(0,0,w*.56,0);veil.addColorStop(0,s.base+'e6');veil.addColorStop(1,s.base+'00');c.fillStyle=veil;c.fillRect(0,0,w,h);c.restore();
  }
  root.AstroPaint=Object.freeze({paint});
})(globalThis);
