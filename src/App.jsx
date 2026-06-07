import { useEffect, useMemo, useRef, useState } from 'react'
import { get, set, del } from 'idb-keyval'
import itemsData from './items.json'
import './styles.css'
import { supabase } from './lib/supabase'

const DB_KEY = 'stone_archive_v3'

function normalizePath(path) {
  if (!path) return ''

  if (String(path).startsWith('data:image')) return path
  if (String(path).startsWith('http')) return path

  let p = String(path)
    .replaceAll('\\','/')
    .replace(/^\/+/,'')

  while (p.includes('images/images/')) {
    p = p.replaceAll('images/images/','images/')
  }

  if (!p.startsWith('images/')) {
    p = 'images/' + p
  }

  return '/' + p
}

function normalizeItem(item,index) {

  const photos = Array.isArray(item.photos)
    ? item.photos.map(normalizePath).filter(Boolean)
    : []

  const image = normalizePath(
    item.image || photos[0]
  )

  const cleanPhotos = [
    ...new Set(
      [image,...photos].filter(Boolean)
    )
  ]

  return {
    id: item.id || `SI-${index}`,
    name: item.name || 'NO NAME',
    value: item.value || item.price || '',
    type: item.type || '',
    category: item.category || '',
    source: item.source || '',
    notes: item.notes || '',
    buyer: item.buyer || '',
    photos: cleanPhotos,
    image: cleanPhotos[0] || ''
  }
}

function fileToDataUrl(file) {
  return new Promise(resolve=>{
    const reader = new FileReader()

    reader.onload = ()=>{
      resolve(reader.result)
    }

    reader.readAsDataURL(file)
  })
}

export default function App() {

  const fileInputRef = useRef(null)

  const [items,setItems] = useState([])
  const [query,setQuery] = useState('')
  const [imageUrl,setImageUrl] = useState('')
  const [selected,setSelected] = useState(null)
  const [zoom,setZoom] = useState(null)
  const [loaded,setLoaded] = useState(false)

  const [aiResults,setAiResults] = useState([])
  const [aiLoading,setAiLoading] = useState(false)

  const [priceFilter,setPriceFilter] = useState('all')
  const [typeFilter,setTypeFilter] = useState('all')
  const [categoryFilter,setCategoryFilter] = useState('all')

  useEffect(()=>{

    async function loadDB(){

      try{

        const { data } =
          await supabase
            .from('items')
            .select('id,name,value,type,category,source,notes,buyer,image,created_at,page,keywords,visualScore')

        if(data && data.length){

          const clean =
            data.map(normalizeItem)

          setItems(clean)

          await set(DB_KEY, clean)

          setLoaded(true)
          return
        }

      }catch(e){
        console.log('SUPABASE LOAD ERROR',e)
      }

      const stored = await get(DB_KEY)

      if(stored && Array.isArray(stored)){
        setItems(stored)
      } else {

        const clean =
          itemsData.map(normalizeItem)

        setItems(clean)

        await set(DB_KEY, clean)
      }

      setLoaded(true)
    }

    loadDB()

  },[])

  async function persist(next){

    setItems(next)

    await set(DB_KEY,next)

  }


  async function syncItem(item){

    const { error } =
      await supabase
        .from('items')
        .upsert(
          [item],
          {
            onConflict:'id'
          }
        )

    if(error){
      console.error('SYNC ITEM ERROR', error)
      alert('Errore sync cloud: ' + error.message)
    }

  }

  async function deleteItemCloud(id){

    const { error } =
      await supabase
        .from('items')
        .delete()
        .eq('id', id)

    if(error){
      console.error('DELETE ITEM ERROR', error)
      alert('Errore delete cloud: ' + error.message)
    }

  }


  async function searchByImage(file){

    try{

      setAiLoading(true)

      const form = new FormData()

      if(file){
        form.append('file', file)
      }

      if(imageUrl.trim()){
        form.append('image_url', imageUrl.trim())
      }


      const res = await fetch(
        'http://127.0.0.1:5001/search-image',
        {
          method:'POST',
          body:form
        }
      )

      const data = await res.json()

      setAiResults(data)

    }catch(err){

      console.error(err)

      alert('Errore ricerca AI')

    }finally{

      setAiLoading(false)

    }

  }

  function openItem(item){
    setSelected({
      ...item,
      photos:[...(item.photos || [])]
    })
  }

  function openZoomGallery(photos,index=0){

    const cleanPhotos =
      (photos || []).filter(Boolean)

    if(!cleanPhotos.length) return

    setZoom({
      photos:cleanPhotos,
      index
    })
  }

  function nextZoomPhoto(e){

    e.stopPropagation()

    setZoom(prev=>{
      if(!prev) return prev

      return {
        ...prev,
        index:
          (prev.index + 1) %
          prev.photos.length
      }
    })
  }

  function prevZoomPhoto(e){

    e.stopPropagation()

    setZoom(prev=>{
      if(!prev) return prev

      return {
        ...prev,
        index:
          (prev.index - 1 + prev.photos.length) %
          prev.photos.length
      }
    })
  }


  async function saveSelected(){

    const clean =
      normalizeItem(selected,0)

    const exists =
      items.some(x=>x.id===clean.id)

    const next = exists
      ? items.map(x=>
          x.id===clean.id
          ? clean
          : x
        )
      : [clean,...items]

    await persist(next)

    await syncItem(clean)

    setSelected(clean)
  }

  async function deleteSelected(){

    if(!selected) return

    if(!confirm(`Eliminare "${selected.name}"?`))
      return

    const next =
      items.filter(
        x=>x.id!==selected.id
      )

    await persist(next)

    await deleteItemCloud(selected.id)

    setSelected(null)
  }

  function deletePhoto(index){

    if(!selected) return

    const photos =
      selected.photos.filter(
        (_,i)=>i!==index
      )

    setSelected({
      ...selected,
      photos,
      image: photos[0] || ''
    })
  }

  async function addPhotos(files){

    if(!selected) return

    const arr =
      [...files].filter(
        f=>f.type.startsWith('image/')
      )

    const data =
      await Promise.all(
        arr.map(fileToDataUrl)
      )

    const photos = [
      ...new Set([
        ...(selected.photos || []),
        ...data
      ])
    ]

    setSelected({
      ...selected,
      photos,
      image: photos[0] || ''
    })
  }

  function updateField(field,value){

    setSelected(prev=>({
      ...prev,
      [field]:value
    }))
  }

  function createNewItem(){

    setSelected({
      id:`SI-${Date.now()}`,
      name:'',
      value:'',
      type:'',
      category:'',
      source:'',
      notes:'',
      buyer:'',
      tags:'',
      photos:[],
      image:''
    })
  }

  async function resetDatabase(){

    if(!confirm('Reset database locale?'))
      return

    await del(DB_KEY)

    location.reload()
  }

  
  async function backupCloud(sourceItems = items){

    const payload = sourceItems.map(x=>({
      id:x.id,
      name:x.name,
      value:x.value,
      type:x.type || '',
      category:x.category || '',
      source:x.source || '',
      notes:x.notes || '',
      buyer:x.buyer || '',
      image:x.image || '',
      photos:x.photos || [],
      page:x.page || '',
      keywords:x.keywords || '',
      visualScore:x.visualScore || null
    }))

    const delRes =
      await supabase
        .from('items')
        .delete()
        .neq('id','___never___')

    console.log('DELETE', delRes)

    const insRes =
      await supabase
        .from('items')
        .insert(payload)

    console.log('INSERT', insRes)

    if(insRes.error){
      alert('ERRORE: ' + insRes.error.message)
      return
    }

    alert('Backup Cloud completato')
  }

  async function restoreCloud(){

    const { data, error } =
      await supabase
        .from('items')
        .select('*')

    if(error){
      alert(error.message)
      return
    }

    if(!data?.length){
      alert('Nessun dato nel cloud')
      return
    }

    await set(DB_KEY,data)
    location.reload()
  }




  async function createSnapshot(){

    const payload = items

    const { error } =
      await supabase
        .from('snapshots')
        .insert([
          {
            item_count: payload.length,
            payload: payload
          }
        ])

    if(error){
      alert('ERRORE SNAPSHOT: ' + error.message)
      return
    }

    alert('Snapshot creata')
  }

  async function restoreLatestSnapshot(){

    const { data, error } =
      await supabase
        .from('snapshots')
        .select('*')
        .order('created_at',{ascending:false})
        .limit(1)

    if(error){
      alert(error.message)
      return
    }

    if(!data?.length){
      alert('Nessuna snapshot trovata')
      return
    }

    const archive = data[0].payload

    await set(DB_KEY, archive)

    setItems(archive)

    alert(
      'Snapshot ripristinata (' +
      archive.length +
      ' capi)'
    )
  }


  function exportJson(){

    const blob = new Blob(
      [JSON.stringify(items,null,2)],
      {type:'application/json'}
    )

    const url =
      URL.createObjectURL(blob)

    const a =
      document.createElement('a')

    a.href = url
    a.download =
      'stone_archive_backup.json'

    a.click()

    URL.revokeObjectURL(url)
  }


  const typeOptions = useMemo(()=>{



    return [...new Set(
      items
        .map(x => x.type || '')
        .filter(Boolean)
    )].sort()

  },[items])



  const categoryOptions = useMemo(()=>{

    return [...new Set(
      items
        .map(x => x.category || '')
        .filter(Boolean)
    )].sort()

  },[items])


  const visible = useMemo(()=>{

    const q =
      query.toLowerCase().trim()

    const words =
      q.split(/\s+/).filter(Boolean)

    return items.filter(item=>{

      const text = [
        item.name,
        item.value,
        item.category,
        item.tags,
        item.notes,
        item.source,
        item.buyer
      ]
      .join(' ')
      .toLowerCase()

      const searchOk =
        !words.length ||
        words.every(
          word => text.includes(word)
        )

      const typeOk =
        typeFilter === 'all'
        ? true
        : (
            String(item.type || '')
            .toLowerCase()
            .includes(
              typeFilter.toLowerCase()
            )
          )

      const price =
        parseInt(
          String(item.value || '')
            .replace(/[^0-9]/g,'')
        ) || 0

      const categoryOk =
        categoryFilter === 'all'
        ? true
        : (
            String(item.category || '')
            .toLowerCase()
            .includes(
              categoryFilter.toLowerCase()
            )
          )

      let priceOk = true

      if(priceFilter === '0-300')
        priceOk = price <= 300

      if(priceFilter === '300-600')
        priceOk = price > 300 && price <= 600

      if(priceFilter === '600-1000')
        priceOk = price > 600 && price <= 1000

      if(priceFilter === '1000+')
        priceOk = price > 1000

      return (
        searchOk &&
        typeOk &&
        categoryOk &&
        priceOk
      )

    })

  },[
    query,
    items,
    priceFilter,
    typeFilter,
    categoryFilter
  ])


  const totalItems = items.length

  const buyerItems =
    items.filter(
      x => x.buyer && String(x.buyer).trim()
    ).length

  const availableItems =
    totalItems - buyerItems


  if(!loaded){
    return (
      <div className="app">
        <h1>Loading database...</h1>
      </div>
    )
  }

  return (

    <div className="app">

      <header className="topbar">

        <div>
          <h1>STONE ISLAND ARCHIVE</h1>

          <p>
            {totalItems} capi in archivio
          </p>

          

        </div>

        <div className="topActions">

          <button onClick={createNewItem}>
            + Aggiungi capo
          </button>

          <details className="toolsMenu">

            <summary>
              ⚙️ Strumenti
            </summary>

            <div className="toolsPanel">

              <button onClick={exportJson}>
                Backup JSON
              </button>

              <button onClick={createSnapshot}>
                📦 Snapshot
              </button>

              <button onClick={restoreLatestSnapshot}>
                ♻️ Ripristina Snapshot
              </button>

              <button onClick={backupCloud}>
                ☁ Backup Cloud
              </button>

              <button onClick={restoreCloud}>
                ☁ Ripristina Cloud
              </button>

              <button
                className="danger"
                onClick={resetDatabase}
              >
                Reset DB
              </button>

            </div>

          </details>

        </div>

      </header>

      <div className="controls">

        <input
          value={query}
          onChange={e=>setQuery(e.target.value)}
          placeholder="Cerca capo..."
        />

        


        <select
          value={typeFilter}
          onChange={e=>setTypeFilter(e.target.value)}
        >
          <option value="all">Tutte le tipologie</option>
          <option value="Jacket">Jacket</option>
          <option value="Parka">Parka</option>
          <option value="Trench">Trench</option>
          <option value="Overshirt">Overshirt</option>
          <option value="Hoodie">Hoodie</option>
          <option value="Crewneck">Crewneck</option>
          <option value="Knitwear">Knitwear</option>
          <option value="Vest">Vest</option>
          <option value="T-Shirt">T-Shirt</option>
          <option value="Pants">Pants</option>
          <option value="Shorts">Shorts</option>
          <option value="Accessory">Accessory</option>
          <option value="Vintage Jacket">Vintage Jacket</option>
          <option value="Reference">Reference</option>
        </select>

        <select
          value={priceFilter}
          onChange={e=>setPriceFilter(e.target.value)}
        >
          <option value="all">Tutti i prezzi</option>
          <option value="0-300">0-300€</option>
          <option value="300-600">300-600€</option>
          <option value="600-1000">600-1000€</option>
          <option value="1000+">1000€+</option>
        </select>

        <select
          value={categoryFilter}
          onChange={e=>setCategoryFilter(e.target.value)}
        >
          <option value="all">Tutte le tecnologie</option>

          {categoryOptions.map(c=>(
            <option key={c} value={c}>
              {c}
            </option>
          ))}

        </select>

      </div>

      <div className="grid">

        {visible.map(item=>(

          <div
            className="card"
            key={item.id}
            style={{
              position:'relative'
            }}
          >

            {item.buyer && (
              <div
                title={item.buyer}
                style={{
                  position:'absolute',
                  top:'10px',
                  right:'10px',
                  zIndex:10,
                  fontSize:'24px'
                }}
              >
                ⭐
              </div>
            )}

            <img loading="lazy"
              src={
                item.image ||
                'https://placehold.co/400x500?text=No+Photo'
              }
              alt={item.name}
              onClick={()=>
                openZoomGallery(
                  item.photos || [item.image],
                  0
                )
              }
              onError={e=>{
                e.currentTarget.src =
                'https://placehold.co/400x500?text=No+Photo'
              }}
            />

            <div className="content">

              <h2>{item.name}</h2>

              <p className="price">
                {item.value}
              </p>

              <p className="meta">
                {item.source ||
                 item.category ||
                 '-'}
              </p>

              <button
                onClick={()=>
                  openItem(item)
                }
              >
                Modifica
              </button>

            </div>

          </div>

        ))}

      </div>

      {selected && (

        <div
          className="modalOverlay"
          onMouseDown={()=>
            setSelected(null)
          }
        >

          <div
            className="modal"
            onMouseDown={e=>
              e.stopPropagation()
            }
          >

            <div className="gallery">

              {selected.photos.length===0 && (
                <div className="placeholder">
                  Nessuna foto
                </div>
              )}

              {selected.photos.map(
                (photo,index)=>(

                <div
                  className="galleryItem"
                  key={photo+index}
                >

                  <img loading="lazy"
                    src={photo}
                    alt=""
                    onClick={()=>
                      openZoomGallery(
                        selected.photos,
                        index
                      )
                    }
                  />

                  <button
                    className="removePhoto"
                    onClick={()=>
                      deletePhoto(index)
                    }
                  >
                    ×
                  </button>

                </div>

              ))}

            </div>

            <div className="editor">

              <button
                className="close"
                onClick={()=>
                  setSelected(null)
                }
              >
                Chiudi
              </button>

              <label>Nome</label>

              <input
                value={selected.name}
                onChange={e=>
                  updateField(
                    'name',
                    e.target.value
                  )
                }
              />

              <label>Valore</label>

              <input
                value={selected.value}
                onChange={e=>
                  updateField(
                    'value',
                    e.target.value
                  )
                }
              />

              <label>Tipologia</label>

              <select
                value={selected.type || ''}
                onChange={e=>
                  updateField(
                    'type',
                    e.target.value
                  )
                }
              >
                <option value="">-- scegli tipologia --</option>
                <option value="Jacket">Jacket</option>
                <option value="Light Jacket">Light Jacket</option>
                <option value="Parka">Parka</option>
                <option value="Smock">Smock</option>
                <option value="Bomber">Bomber</option>
                <option value="Raso">Raso</option>
                <option value="Overshirt">Overshirt</option>
                <option value="Hoodie">Hoodie</option>
                <option value="Crewneck">Crewneck</option>
                <option value="Knitwear">Knitwear</option>
                <option value="Vest">Vest</option>
                <option value="T-Shirt">T-Shirt</option>
                <option value="Cargo">Cargo</option>
                <option value="Pantaloni">Pantaloni</option>
                <option value="Pants">Pants</option>
                <option value="Shorts">Shorts</option>
                <option value="Tuta">Tuta</option>
                <option value="Trench">Trench</option>
                <option value="Accessory">Accessory</option>
                <option value="Reference">Reference</option>
              </select>

              <label>Tecnologia / Collezione</label>

              <input
                list="category-list"
                value={selected.category || ''}
                onChange={e=>
                  updateField(
                    'category',
                    e.target.value
                  )
                }
                placeholder="Scrivi nuova tecnologia"
              />

              <datalist id="category-list">
                {categoryOptions.map(c=>(
                  <option key={c} value={c} />
                ))}
              </datalist>

              <select
                value=""
                onChange={e=>{
                  if(e.target.value){
                    updateField(
                      'category',
                      e.target.value
                    )
                  }
                }}
              >
                <option value="">Oppure scegli tecnologia esistente</option>
                {categoryOptions.map(c=>(
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <label>
                Acquirente / contatto
              </label>

              <input
                value={selected.buyer}
                onChange={e=>
                  updateField(
                    'buyer',
                    e.target.value
                  )
                }
              />

              <label>Fonte / taglia</label>

              <input
                value={selected.source}
                onChange={e=>
                  updateField(
                    'source',
                    e.target.value
                  )
                }
              />

              <label>Note</label>

              <textarea
                value={selected.notes}
                onChange={e=>
                  updateField(
                    'notes',
                    e.target.value
                  )
                }
              />

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={e=>
                  addPhotos(
                    e.target.files
                  )
                }
              />

              <div
                className="dropzone"
                onClick={()=>
                  fileInputRef.current.click()
                }
                onDragOver={e=>{
                  e.preventDefault()
                }}
                onDrop={e=>{
                  e.preventDefault()
                  addPhotos(
                    e.dataTransfer.files
                  )
                }}
              >
                <strong>Trascina foto qui</strong>
                <span>oppure clicca per caricare</span>
              </div>

              <button
                className="save"
                onClick={saveSelected}
              >
                Salva modifiche
              </button>

              <button
                className="delete"
                onClick={deleteSelected}
              >
                Elimina scheda
              </button>

            </div>

          </div>

        </div>

      )}

      {zoom && (

        <div
          className="zoom"
          onClick={()=>
            setZoom(null)
          }
        >

          {zoom.photos.length > 1 && (
            <button
              className="zoomNav zoomPrev"
              onClick={prevZoomPhoto}
            >
              ‹
            </button>
          )}

          <img loading="lazy"
            src={zoom.photos[zoom.index]}
            alt=""
            onClick={e=>
              e.stopPropagation()
            }
          />

          {zoom.photos.length > 1 && (
            <button
              className="zoomNav zoomNext"
              onClick={nextZoomPhoto}
            >
              ›
            </button>
          )}

          {zoom.photos.length > 1 && (
            <div className="zoomCounter">
              {zoom.index + 1} / {zoom.photos.length}
            </div>
          )}

        </div>

      )}

    </div>

  )
}
