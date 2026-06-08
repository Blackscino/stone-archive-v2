import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabase = createClient(
  'https://kckwtorebqzrwpbbffqy.supabase.co',
  process.env.SUPABASE_SECRET_KEY
)

function extFromDataUrl(dataUrl){
  const m = dataUrl.match(/^data:image\/([^;]+);base64,/)
  if(!m) return 'jpg'
  const ext = m[1].toLowerCase()
  if(ext === 'jpeg') return 'jpg'
  return ext
}

function bufferFromDataUrl(dataUrl){
  const base64 = dataUrl.split(',')[1]
  return Buffer.from(base64,'base64')
}

function slug(s){
  return String(s || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,60)
}

const { data: items, error } = await supabase
  .from('items')
  .select('id,name,image,photos')
  .like('image','data:image%')
  .limit(10)

if(error){
  console.error(error)
  process.exit(1)
}

console.log('RECORDS TO MIGRATE:', items.length)

fs.writeFileSync(
  `backup_base64_${Date.now()}.json`,
  JSON.stringify(items,null,2)
)

let migratedRecords = 0
let migratedPhotos = 0

for(const item of items){

  const photos = Array.isArray(item.photos)
    ? item.photos
    : []

  const newPhotos = []

  for(let i=0;i<photos.length;i++){

    const photo = photos[i]

    if(
      typeof photo === 'string' &&
      photo.startsWith('data:image')
    ){

      const ext = extFromDataUrl(photo)

      const path =
        `migrated/${item.id}-${slug(item.name)}-${i+1}.${ext}`

      const buffer =
        bufferFromDataUrl(photo)

      const { error: uploadError } =
        await supabase
          .storage
          .from('stone-images')
          .upload(
            path,
            buffer,
            {
              upsert:true,
              contentType:
                ext === 'jpg'
                  ? 'image/jpeg'
                  : `image/${ext}`
            }
          )

      if(uploadError){
        console.error(
          'UPLOAD ERROR:',
          item.name,
          uploadError.message
        )
        process.exit(1)
      }

      const { data } =
        supabase
          .storage
          .from('stone-images')
          .getPublicUrl(path)

      newPhotos.push(data.publicUrl)

      migratedPhotos++

    }else{

      newPhotos.push(photo)

    }
  }

  let newImage = item.image

  if(
    typeof newImage === 'string' &&
    newImage.startsWith('data:image')
  ){
    newImage = newPhotos[0] || ''
  }

  const { error:updateError } =
    await supabase
      .from('items')
      .update({
        image:newImage,
        photos:newPhotos
      })
      .eq('id',item.id)

  if(updateError){
    console.error(
      'UPDATE ERROR:',
      item.name,
      updateError.message
    )
    process.exit(1)
  }

  migratedRecords++

  console.log(
    `${migratedRecords}/${items.length} - ${item.name}`
  )
}

console.log('----------------------')
console.log('MIGRATED RECORDS:', migratedRecords)
console.log('MIGRATED PHOTOS:', migratedPhotos)
console.log('DONE')
