'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Link from 'next/link'

// Фикс иконок маркеров Leaflet в webpack/Next.js
const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

type Person = {
  id: string
  first_name: string | null
  last_name: string | null
  middle_name: string | null
  birth_date: string | null
  death_date: string | null
  burial_place: string | null
  burial_lat: number
  burial_lng: number
  main_photo_url: string | null
}

type Props = {
  persons: Person[]
  centerLat?: number
  centerLng?: number
}

export default function BurialMap({ persons, centerLat = 55.75, centerLng = 37.62 }: Props) {
  useEffect(() => {
    // Устанавливаем иконку по умолчанию
    L.Marker.prototype.options.icon = markerIcon
  }, [])

  const center: [number, number] = persons.length > 0
    ? [persons[0].burial_lat, persons[0].burial_lng]
    : [centerLat, centerLng]

  return (
    <MapContainer
      center={center}
      zoom={persons.length === 1 ? 15 : 10}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {persons.map(person => {
        const name = [person.last_name, person.first_name, person.middle_name].filter(Boolean).join(' ') || 'Без имени'
        const birth = person.birth_date ? new Date(person.birth_date).getFullYear() : null
        const death = person.death_date ? new Date(person.death_date).getFullYear() : null
        const years = (birth || death) ? `${birth ?? '?'} – ${death ?? '...'}` : ''

        return (
          <Marker key={person.id} position={[person.burial_lat, person.burial_lng]} icon={markerIcon}>
            <Popup minWidth={200}>
              <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
                {person.main_photo_url && (
                  <img
                    src={person.main_photo_url}
                    alt={name}
                    style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }}
                  />
                )}
                <div style={{ fontWeight: 600, fontSize: 14, color: '#1c1917', marginBottom: 2 }}>{name}</div>
                {years && <div style={{ fontSize: 12, color: '#78716c', marginBottom: 4 }}>{years}</div>}
                {person.burial_place && (
                  <div style={{ fontSize: 12, color: '#78716c', marginBottom: 8 }}>📍 {person.burial_place}</div>
                )}
                <a
                  href={`/p/${person.id}`}
                  style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    background: '#1c1917',
                    color: 'white',
                    borderRadius: 6,
                    fontSize: 12,
                    textDecoration: 'none',
                  }}
                >
                  Открыть профиль →
                </a>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
