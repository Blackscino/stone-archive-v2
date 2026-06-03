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
  const [selected,setSelected] = useState(null)
  const [zoom,setZoom] = useState(null)
  const [loaded,setLoaded] = useState(false)

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
      category:'',
      source:'',
      notes:'',
      buyer:'',
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

    if(!q) return items

    const words =
      q.split(/\s+/).filter(Boolean)

    return items.filter(item=>{

      const text = [
        item.name,
        item.value,
        item.category,
        item.notes,
        item.source,
        item.buyer
      ]
      .join(' ')
      .toLowerCase()

      return words.every(
        word => text.includes(word)
      )

    })

  },[query,items])

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

      </div>

      <div className="grid">

        {visible.map(item=>(

          <div
            className="card"
            key={item.id}
          >

            <img
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

                  <img
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

              <label>Categoria</label>

              <input
                value={selected.category}
                onChange={e=>
                  updateField(
                    'category',
                    e.target.value
                  )
                }
              />

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

          <img
            src={zoom}
            alt=""
          />

        </div>

      )}

    </div>

  )
}
