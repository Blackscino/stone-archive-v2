import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://kckwtorebqzrwpbbffqy.supabase.co',
  'sb_publishable_p8iGYX9Q9gOpvpdLsmUtDw_YOcAiiqJ'
)

const { data, error } = await supabase
  .from('items')
  .select('id,name,image,photos')
  .like('image','data:image%')

if(error){
  console.error(error)
  process.exit(1)
}

console.log('RECORDS_BASE64:', data.length)

let totalPhotos = 0

const report = data.map(x=>{
  const photos = Array.isArray(x.photos) ? x.photos : []
  totalPhotos += photos.length

  const imageSize =
    typeof x.image === 'string'
      ? x.image.length
      : 0

  return {
    id: x.id,
    name: x.name,
    photos: photos.length,
    image_size: imageSize
  }
})

report
  .sort((a,b)=>b.image_size-a.image_size)
  .slice(0,20)
  .forEach(r=>{
    console.log(
      `${r.photos} foto | ${r.image_size} chars | ${r.name}`
    )
  })

console.log('TOTAL_PHOTOS:', totalPhotos)
