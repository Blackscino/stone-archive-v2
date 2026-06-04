import { useEffect, useMemo, useRef, useState } from 'react'
import { get, set, del } from 'idb-keyval'
import itemsData from './items.json'
import './styles.css'

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
  const [aiText,setAiText] = useState('')
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

      form.append('text', aiText)

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
          <h1>Stone Archive V3</h1>

          <p>
            {visible.length} capi visibili
          </p>

          <p>
            Archivio: {totalItems} capi
            {' • '}
            Disponibili: {availableItems}
            {' • '}
            Acquirente ⭐: {buyerItems}
          </p>

        </div>

        <div className="topActions">

          <button onClick={createNewItem}>
            + Aggiungi capo
          </button>

          <button onClick={exportJson}>
            Backup JSON
          </button>

          <button
            className="danger"
            onClick={resetDatabase}
          >
            Reset DB
          </button>

        </div>

      </header>

      <div className="controls">

        <input
          value={query}
          onChange={e=>setQuery(e.target.value)}
          placeholder="Cerca capo..."
        />

        <select
        >
          <option value="all">Tutti</option>
          <option value="available">Disponibili</option>
          <option value="sold">Venduti ⭐</option>
        </select>

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

          <option value="Reflective">Reflective</option>
          <option value="Ghost Piece">Ghost Piece</option>
          <option value="Ice Jacket">Ice Jacket</option>
          <option value="Shadow Project">Shadow Project</option>
          <option value="Marina">Marina</option>
          <option value="Tela Stella">Tela Stella</option>
          <option value="Raso Gommato">Raso Gommato</option>
          <option value="Prototype">Prototype</option>
          <option value="Supreme">Supreme</option>
          <option value="Nike">Nike</option>
          <option value="Archive">Archive</option>

        </select>

        <input
          value={aiText}
          onChange={e=>setAiText(e.target.value)}
          placeholder="Parole guida (es: tela stella, ghost piece, ice jacket)"
        />


        <input
          type="file"
          accept="image/*"
          onChange={e=>{
            const file = e.target.files?.[0]
            if(file) searchByImage(file)
          }}
        />

        <input
          value={imageUrl}
          onChange={e=>setImageUrl(e.target.value)}
          placeholder="URL immagine (Vinted, eBay, ecc...)"
          style={{minWidth:'420px'}}
        />

        <button
          onClick={()=>{
            if(imageUrl.trim()){
              searchByImage(null)
            }
          }}
        >
          Analizza URL
        </button>

        {aiLoading && (
          <p>Ricerca AI in corso...</p>
        )}

        {aiResults.length > 0 && (

          <div style={{width:'100%'}}>

            <h3>
              Risultati AI
            </h3>

            {aiResults
              .slice(0,20)
              .map(r=>(

              <div
                key={r.id}
                style={{
                  padding:'10px',
                  border:'1px solid #333',
                  marginBottom:'8px',
                  cursor:'pointer',
                  borderRadius:'8px'
                }}
                onClick={()=>{
                  const item =
                    items.find(
                      x=>String(x.id)===String(r.id)
                    )

                  if(item){

                    setQuery(item.name)

                    openItem(item)

                    window.scrollTo({
                      top:0,
                      behavior:'smooth'
                    })

                  }
                }}
              >

                <div
                  style={{
                    display:'flex',
                    alignItems:'center',
                    gap:'12px'
                  }}
                >

                  <img loading="lazy"
                    src={normalizePath(r.image)}
                    alt=""
                    style={{
                      width:'70px',
                      height:'70px',
                      objectFit:'cover',
                      borderRadius:'8px'
                    }}
                  />

                  <div>

                    <strong>{r.name}</strong>

                    <div>
                      {r.value}
                    </div>

                    <div>
                      Match: {r.score}%
                    </div>

                  </div>

                </div>

              </div>

            ))}

          </div>

        )}

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
                item.image &&
                setZoom(item.image)
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

        <div className="modalOverlay">

          <div className="modal">

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
                      setZoom(photo)
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

                <option value="">
                  -- seleziona --
                </option>

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

              <label>Tecnologia / Collezione</label>

              <select
                value={selected.category || ''}
                onChange={e=>
                  updateField(
                    'category',
                    e.target.value
                  )
                }
              >

                <option value="">
                  -- seleziona --
                </option>

                <option value="Reflective">Reflective</option>
                <option value="Ghost Piece">Ghost Piece</option>
                <option value="Ice Jacket">Ice Jacket</option>
                <option value="Shadow Project">Shadow Project</option>
                <option value="Marina">Marina</option>
                <option value="Tela Stella">Tela Stella</option>
                <option value="Raso Gommato">Raso Gommato</option>
                <option value="Prototype">Prototype</option>
                <option value="Supreme">Supreme</option>
                <option value="Nike">Nike</option>
                <option value="Archive">Archive</option>

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

              <button
                onClick={()=>
                  fileInputRef.current.click()
                }
              >
                + Aggiungi foto
              </button>

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

          <img loading="lazy"
            src={zoom}
            alt=""
          />

        </div>

      )}

    </div>

  )
}
