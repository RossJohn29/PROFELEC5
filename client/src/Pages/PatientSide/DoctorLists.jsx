//DoctorLists.jsx
import React, { useState, useEffect, useMemo, useDeferredValue, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'  
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import PNavbar from '../../SideBar/PNavbar'
import '../../Styles/DoctorList.css'
import apiUrl from '../../api/base'
import AutoSizer from 'react-virtualized-auto-sizer'
import { FixedSizeGrid as Grid } from 'react-window'

// Memoized card to avoid unnecessary re-renders
const DoctorCard = React.memo(function DoctorCard({
  doc,
  isFavorite,
  isPending,
  onBook,
  onToggleFavorite
}) {
  const fullName = `${doc.firstName || ''} ${doc.lastName || ''}`.trim()
  const avgRating = doc.avgRating !== undefined && doc.avgRating !== null ? Number(doc.avgRating) : null
  const ratingCount = doc.ratingCount !== undefined && doc.ratingCount !== null ? Number(doc.ratingCount) : 0
  
  const ratingText = (ratingCount > 0 && avgRating !== null)
    ? `${avgRating.toFixed(1)} ★ (${ratingCount} reviews)`
    : 'No reviews yet'

  return (
    <div className="doctor-card">
      <div className="card-grid">
        <div className="card-image">
          <img
            src={doc.profileImage || 'https://via.placeholder.com/120'}
            alt={fullName}
            loading="lazy"
            width={120}
            height={120}
          />
        </div>
        <div className="card-info">
          <h3 className="doctor-name">{fullName}</h3>
          <p className="doctor-role">{doc.specialty ?? '—'}</p>
          <p className="doctor-price">₱ {doc.fees ?? '—'} / session</p>
          <p className="doctor-rating">{ratingText}</p>
        </div>
        <div className="card-action card-action-left">
          <button className="book-btn" onClick={onBook}>Book Now</button>
        </div>
        <div className="card-action card-action-right">
          <button
            className={`fav-btn ${isFavorite ? 'filled' : 'hollow'}`}
            onClick={onToggleFavorite}
            disabled={isPending}
            aria-pressed={isFavorite}
            title={isFavorite ? 'Remove favorite' : 'Add favorite'}
          >
            {isPending ? '...' : (isFavorite ? '★' : '☆')}
          </button>
        </div>
      </div>
    </div>
  )
})

function VirtualizedGrid({ items, renderItem, estimatedRowHeight = 220, minCardWidth = 320, className = '' }) {
  if (!items || items.length <= 20) {
    return (
      <div className={`doctor-grid ${className}`}>
        {items.map((item, idx) => (
          <React.Fragment key={item._id || idx}>{renderItem(item, idx)}</React.Fragment>
        ))}
      </div>
    )
  }

  return (
    <div className={`virtual-grid ${className}`} style={{ width: '100%', height: '70vh' }}>
      <AutoSizer disableHeight={false}>
        {({ width, height }) => {
          const columns = Math.max(1, Math.floor(width / minCardWidth))
          const columnWidth = Math.floor(width / columns)
          const rowCount = Math.ceil(items.length / columns)

          return (
            <Grid
              columnCount={columns}
              columnWidth={columnWidth}
              height={height}
              rowCount={rowCount}
              rowHeight={estimatedRowHeight}
              width={width}
              overscanRowCount={3}
            >
              {({ columnIndex, rowIndex, style }) => {
                const index = rowIndex * columns + columnIndex
                if (index >= items.length) return null
                const item = items[index]
                return (
                  <div style={style}>
                    {renderItem(item, index)}
                  </div>
                )
              }}
            </Grid>
          )
        }}
      </AutoSizer>
    </div>
  )
}

function DoctorLists() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSpecialty, setSelectedSpecialty] = useState('All Categories')
  const [favorites, setFavorites] = useState([])
  const [pendingFavs, setPendingFavs] = useState([])
  const [searchInput, setSearchInput] = useState('')
  const searchQuery = useDeferredValue(searchInput)
  const [selectedRating, setSelectedRating] = useState('All Ratings')
  const [selectedFeeRange, setSelectedFeeRange] = useState('All Fees')
  const navigate = useNavigate()

  useEffect(() => {
    const controller = new AbortController()
    let timedOut = false
    let mounted = true

    const timeoutMs = 100000 // Increased to 10s for better reliability
    const timeoutId = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
    
    const fetchDoctors = async () => {
      setLoading(true)
      try {
        // Use the optimized endpoint with ratings
        const res = await fetch(apiUrl('/api/doctors/with-ratings'), { 
          signal: controller.signal 
        })
        
        const contentType = res.headers.get('content-type') || ''
        
        if (!res.ok) {
          throw new Error(`Doctors endpoint returned ${res.status}`)
        }
        
        if (!contentType.includes('application/json')) {
          const txt = await res.text()
          console.error('Unexpected non-JSON response:', txt.slice(0, 200))
          throw new Error('Unexpected response from doctors endpoint')
        }
        
        const data = await res.json()
        
        // Handle different response formats
        let doctorsList = []
        if (data && Array.isArray(data.doctors)) {
          doctorsList = data.doctors
        } else if (Array.isArray(data)) {
          doctorsList = data
        } else if (data.status === 'success' && Array.isArray(data.doctors)) {
          doctorsList = data.doctors
        }
        
        // Ensure each doctor has rating fields
        doctorsList = doctorsList.map(doc => ({
          ...doc,
          avgRating: doc.avgRating !== undefined ? Number(doc.avgRating) : null,
          ratingCount: doc.ratingCount !== undefined ? Number(doc.ratingCount) : 0
        }))
        
        if (mounted) {
          setDoctors(doctorsList)
        }
      } catch (err) {
        if (err.name === 'AbortError' && timedOut) {
          console.warn('[DoctorLists] fetch timed out after', timeoutMs, 'ms')
          if (mounted) setDoctors([])
        } else if (err.name !== 'AbortError') {
          console.error('Error fetching doctors list:', err)
          // Fallback to basic endpoint
          try {
            const r = await fetch(apiUrl('/api/doctors'), { signal: controller.signal })
            const d = await r.json()
            const list = Array.isArray(d) ? d : []
            if (mounted) {
              setDoctors(list.map(doc => ({
                ...doc,
                avgRating: null,
                ratingCount: 0
              })))
            }
          } catch (e) {
            if (e.name !== 'AbortError') {
              console.error('Fallback fetch failed:', e)
            }
          }
        }
      } finally {
        clearTimeout(timeoutId)
        if (mounted) setLoading(false)
      }
    }

    fetchDoctors()

    return () => { 
      mounted = false
      controller.abort() 
    }
  }, [])

  const FIXED_SPECIALTIES = [
    'Mental Health',
    'General Psychiatry',
    'Child and Adolescent Psychiatry',
    'Addiction Psychiatry',
    'Community Psychiatry',
    'Psychotherapy',
    'Registered Psychometrician'
  ]

  const specialties = useMemo(() => {
    const hasOther = doctors.some(d => {
      const sp = (d.specialty || '').trim()
      return sp && !FIXED_SPECIALTIES.includes(sp)
    })

    return hasOther
      ? ['All Categories', 'My Favorites', ...FIXED_SPECIALTIES, 'Other']
      : ['All Categories', 'My Favorites', ...FIXED_SPECIALTIES]
  }, [doctors])

  useEffect(() => {
    if (selectedSpecialty !== 'All Categories' && selectedSpecialty !== 'My Favorites' && !specialties.includes(selectedSpecialty)) {
      setSelectedSpecialty('All Categories')
    }
  }, [specialties, selectedSpecialty])

  const filteredDoctors = useMemo(() => doctors.filter((doc) => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const fullName = `${doc.firstName || ''} ${doc.lastName || ''}`.toLowerCase()
      const specialty = (doc.specialty || '').toLowerCase()
      const fees = String(doc.fees || '')
      if (!fullName.includes(query) && !specialty.includes(query) && !fees.includes(query)) {
        return false
      }
    }

    if (selectedRating !== 'All Ratings') {
      const rating = Number(doc.avgRating) || 0
      if (selectedRating === '5 Stars' && rating < 5) return false
      if (selectedRating === '4 Stars - 4.9 Stars' && (rating < 4 || rating > 4.9)) return false
      if (selectedRating === '3 Stars - 3.9 Stars' && (rating < 3 || rating > 3.9)) return false
      if (selectedRating === '2 Stars - 2.9 Stars' && (rating < 2 || rating > 2.9)) return false
      if (selectedRating === '1 Star - 1.9 Stars' && (rating < 1 || rating > 1.9)) return false
    }

    if (selectedFeeRange !== 'All Fees') {
      const fee = Number(doc.fees) || 0
      if (selectedFeeRange === '₱0 - ₱500' && (fee < 0 || fee > 500)) return false
      if (selectedFeeRange === '₱500 - ₱1000' && (fee < 500 || fee > 1000)) return false
      if (selectedFeeRange === '₱1000 - ₱1500' && (fee < 1000 || fee > 1500)) return false
      if (selectedFeeRange === '₱1500 - ₱2000' && (fee < 1500 || fee > 2000)) return false
      if (selectedFeeRange === '₱2000+' && fee < 2000) return false
    }

    return true
  }), [doctors, searchQuery, selectedRating, selectedFeeRange])

  const favSet = useMemo(() => new Set(favorites.map(String)), [favorites])
  const favoriteDoctors = useMemo(() => filteredDoctors.filter((d) => favSet.has(String(d._id))), [filteredDoctors, favSet])
  const otherDoctors = useMemo(() => filteredDoctors.filter((d) => !favSet.has(String(d._id))), [filteredDoctors, favSet])
  
  const specialtyDoctors = useMemo(() => {
    if (selectedSpecialty === 'Other') {
      return filteredDoctors.filter((d) => {
        const sp = (d.specialty || '').trim()
        return sp && !FIXED_SPECIALTIES.includes(sp)
      })
    }
    return filteredDoctors.filter((d) => FIXED_SPECIALTIES.includes((d.specialty || '').trim()) && (d.specialty || '').trim() === selectedSpecialty)
  }, [filteredDoctors, selectedSpecialty])

  useEffect(() => {
    const email = localStorage.getItem('email')
    if (!email) {
      try {
        const raw = localStorage.getItem('favDocs')
        if (raw) setFavorites(JSON.parse(raw).map((id) => String(id)))
      } catch (e) {
        // ignore errors
      }
      return
    }

    fetch(apiUrl('/patient/get-profile'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })
      .then((res) => res.json())
      .then((data) => {
        const favs = (data.patient && data.patient.favorites) || []
        setFavorites(favs.map((id) => id.toString()))
      })
      .catch((err) => {
        console.error('Error fetching patient profile for favorites:', err)
        try {
          const raw = localStorage.getItem('favDocs')
          if (raw) setFavorites(JSON.parse(raw).map((id) => String(id)))
        } catch (e) {
          // ignore errors
        }
      })
  }, [])

  const toggleFavorite = useCallback(async (docId) => {
    const email = localStorage.getItem('email')
    if (!email) {
      alert('Please login to save favorites')
      return
    }

    const idStr = String(docId)
    const wasFav = favorites.includes(idStr)
    const action = wasFav ? 'remove' : 'add'

    const previousFavs = favorites
    setFavorites((prev) => (wasFav ? prev.filter((id) => id !== idStr) : [...prev, idStr]))
    setPendingFavs((p) => (p.includes(idStr) ? p : [...p, idStr]))

    try {
      const res = await fetch(apiUrl('/patient/favorites'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, doctorId: idStr, action })
      })
      const data = await res.json()

      if (data.status === 'success') {
        const serverFavs = (data.favorites || []).map((id) => id.toString())
        setFavorites(serverFavs)
        try { localStorage.setItem('favDocs', JSON.stringify(serverFavs)) } catch (e) { /* ignore */ }
      } else {
        console.error('Failed updating favorites:', data)
        setFavorites(previousFavs)
        alert('Unable to update favorites. Please try again.')
      }
    } catch (err) {
      console.error('Error toggling favorite:', err)
      setFavorites(previousFavs)
      alert('Network error while updating favorites. Please try again.')
    } finally {
      setPendingFavs((p) => p.filter((id) => id !== idStr))
    }
  }, [favorites])

  const handleBook = useCallback((email) => {
    // Store current scroll position before navigating
    sessionStorage.setItem('doctorListScrollY', window.scrollY.toString())
    sessionStorage.setItem('doctorListFilters', JSON.stringify({
      specialty: selectedSpecialty,
      rating: selectedRating,
      feeRange: selectedFeeRange,
      search: searchInput
    }))
    navigate(`/BookApp/${encodeURIComponent(email)}`, { state: { email } })
  }, [navigate, selectedSpecialty, selectedRating, selectedFeeRange, searchInput])

  // Restore scroll position and filters when coming back
  useEffect(() => {
    const scrollY = sessionStorage.getItem('doctorListScrollY')
    const filters = sessionStorage.getItem('doctorListFilters')
    
    if (scrollY) {
      setTimeout(() => {
        window.scrollTo(0, parseInt(scrollY, 10))
        sessionStorage.removeItem('doctorListScrollY')
      }, 100)
    }
    
    if (filters) {
      try {
        const parsed = JSON.parse(filters)
        setSelectedSpecialty(parsed.specialty || 'All Categories')
        setSelectedRating(parsed.rating || 'All Ratings')
        setSelectedFeeRange(parsed.feeRange || 'All Fees')
        setSearchInput(parsed.search || '')
        sessionStorage.removeItem('doctorListFilters')
      } catch (e) {
        console.error('Error restoring filters:', e)
      }
    }
  }, [])

  return (
    <div className="list-dashboard">
      <PNavbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="list-dashboard-main doctor-page">
        <div className="doctor-header-box">
          <h2 className="doctor-title">List of Psychiatrists</h2>
          
          <div className="doctor-search-container">
            <input
              type="text"
              className="doctor-search-input"
              placeholder="Search by name, specialty, or fees"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search doctors"
            />
            {searchInput && (
              <button
                className="doctor-search-clear"
                onClick={() => setSearchInput('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="doctor-filter-container">
            <select
              className="doctor-filter"
              value={selectedSpecialty}
              onChange={(e) => setSelectedSpecialty(e.target.value)}
              aria-label="Filter by specialty"
            >
              {specialties.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              className="doctor-filter"
              value={selectedRating}
              onChange={(e) => setSelectedRating(e.target.value)}
              aria-label="Filter by rating"
            >
              <option value="All Ratings">All Ratings</option>
              <option value="5 Stars">5 ★</option>
              <option value="4 Stars - 4.9 Stars">4 ★ - 4.9 ★</option>
              <option value="3 Stars - 3.9 Stars">3 ★ - 3.9 ★</option>
              <option value="2 Stars - 2.9 Stars">2 ★ - 2.9 ★</option>
              <option value="1 Star - 1.9 Stars">1 ★ - 1.9 ★</option>
            </select>

            <select
              className="doctor-filter"
              value={selectedFeeRange}
              onChange={(e) => setSelectedFeeRange(e.target.value)}
              aria-label="Filter by fees"
            >
              <option value="All Fees">All Fees</option>
              <option value="₱0 - ₱500">₱0 - ₱500</option>
              <option value="₱500 - ₱1000">₱500 - ₱1000</option>
              <option value="₱1000 - ₱1500">₱1000 - ₱1500</option>
              <option value="₱1500 - ₱2000">₱1500 - ₱2000</option>
              <option value="₱2000+">₱2000+</option>
            </select>
          </div>
        </div>

        {loading ? (
          <>
            <h3 className="doctor-subtitle"><Skeleton width={200} height={24} /></h3>
            <div className="doctor-grid">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="doctor-card">
                  <div className="card-grid">
                    <div className="card-image">
                      <Skeleton circle width={120} height={120} />
                    </div>
                    <div className="card-info">
                      <h3 className="doctor-name">
                        <Skeleton width={150} height={20} />
                      </h3>
                      <p className="doctor-role">
                        <Skeleton width={100} height={16} />
                      </p>
                      <p className="doctor-price">
                        <Skeleton width={120} height={16} />
                      </p>
                      <p className="doctor-rating">
                        <Skeleton width={130} height={16} />
                      </p>
                    </div>
                    <div className="card-action card-action-left">
                      <Skeleton width={100} height={36} borderRadius={8} />
                    </div>
                    <div className="card-action card-action-right">
                      <Skeleton circle width={36} height={36} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (() => {
          if (selectedSpecialty === 'All Categories') {
            const favs = favoriteDoctors
            const others = otherDoctors
            if (favs.length === 0 && others.length === 0) return <p>No available doctors as of the moment...</p>
            return (
              <>
                {favs.length > 0 && (
                  <>
                    <h3 className="doctor-subtitle">My Favorites</h3>
                    <VirtualizedGrid
                      items={favs}
                      className={`${favs.length <= 2 ? 'few-cards' : ''}`}
                      renderItem={(doc) => {
                        const id = String(doc._id)
                        return (
                          <DoctorCard
                            key={`fav-${id}`}
                            doc={doc}
                            isFavorite={favorites.includes(id)}
                            isPending={pendingFavs.includes(id)}
                            onBook={() => handleBook(doc.email)}
                            onToggleFavorite={() => toggleFavorite(doc._id)}
                          />
                        )
                      }}
                    />
                  </>
                )}

                <h3 className="doctor-subtitle">Other Doctors</h3>
                <VirtualizedGrid
                  items={others}
                  className={`${others.length <= 2 ? 'few-cards' : ''}`}
                  renderItem={(doc) => {
                    const id = String(doc._id)
                    return (
                      <DoctorCard
                        key={id}
                        doc={doc}
                        isFavorite={favorites.includes(id)}
                        isPending={pendingFavs.includes(id)}
                        onBook={() => handleBook(doc.email)}
                        onToggleFavorite={() => toggleFavorite(doc._id)}
                      />
                    )
                  }}
                />
              </>
            )
          }

          if (selectedSpecialty === 'My Favorites') {
            if (favoriteDoctors.length === 0) return <p>No available doctors as of the moment...</p>
            return (
              <>
                <h3 className="doctor-subtitle">My Favorites</h3>
                <VirtualizedGrid
                  items={favoriteDoctors}
                  className={`${favoriteDoctors.length <= 2 ? 'few-cards' : ''}`}
                  renderItem={(doc) => {
                    const id = String(doc._id)
                    return (
                      <DoctorCard
                        key={`fav-${id}`}
                        doc={doc}
                        isFavorite={favorites.includes(id)}
                        isPending={pendingFavs.includes(id)}
                        onBook={() => handleBook(doc.email)}
                        onToggleFavorite={() => toggleFavorite(doc._id)}
                      />
                    )
                  }}
                />
              </>
            )
          }

          if (specialtyDoctors.length === 0) return <p>No available doctors as of the moment...</p>
          return (
            <>
              <h3 className="doctor-subtitle">{selectedSpecialty}</h3>
              <VirtualizedGrid
                items={specialtyDoctors}
                className={`${specialtyDoctors.length <= 2 ? 'few-cards' : ''}`}
                renderItem={(doc) => {
                  const id = String(doc._id)
                  return (
                    <DoctorCard
                      key={id}
                      doc={doc}
                      isFavorite={favorites.includes(id)}
                      isPending={pendingFavs.includes(id)}
                      onBook={() => handleBook(doc.email)}
                      onToggleFavorite={() => toggleFavorite(doc._id)}
                    />
                  )
                }}
              />
            </>
          )
        })()}
      </div>
    </div>
  )
}

export default DoctorLists