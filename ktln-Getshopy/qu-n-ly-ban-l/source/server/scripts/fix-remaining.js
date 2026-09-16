const {PrismaClient}=require('@prisma/client');
const fs=require('fs');
const p=new PrismaClient();
const pools=JSON.parse(fs.readFileSync('./scripts/data/real-image-pools.json','utf-8'));

(async()=>{
  // Fix remaining picsum
  const rem=await p.product.findMany({where:{is_deleted:false, image:{contains:'picsum'}}, select:{id:true,category_id:true}});
  console.log('Fixing',rem.length,'remaining picsum...');
  for(const r of rem){
    const pool=pools[r.category_id]||pools['cat-phone'];
    const img=pool[Math.floor(Math.random()*pool.length)];
    const imgs=[pool[Math.floor(Math.random()*pool.length)],pool[Math.floor(Math.random()*pool.length)],pool[Math.floor(Math.random()*pool.length)]];
    await p.product.update({where:{id:r.id},data:{image:img,images:JSON.stringify(imgs)}});
  }
  console.log('Done picsum');

  // Fix remaining Khác
  const khac=await p.product.findMany({where:{brand_id:'br-khac',name:{contains:'Khác'},is_deleted:false},select:{id:true,name:true}});
  console.log('Fixing',khac.length,'remaining Khác names...');
  for(const k of khac){
    const n=k.name.replace(/Khác/g,'').replace(/\s{2,}/g,' ').trim();
    await p.product.update({where:{id:k.id},data:{name:n}});
  }
  console.log('All done!');

  const c1=await p.product.count({where:{is_deleted:false,image:{contains:'picsum'}}});
  const c2=await p.product.count({where:{brand_id:'br-khac',name:{contains:'Khác'},is_deleted:false}});
  console.log('Remaining picsum:',c1,'Remaining Khác:',c2);
})().finally(()=>p.$disconnect());
