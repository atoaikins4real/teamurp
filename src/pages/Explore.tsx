import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeatmapLayer } from '../components/HeatmapLayer';
import { MapContainer, TileLayer, Marker, useMapEvents, ZoomControl, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Search, Star, Navigation, ShieldCheck, 
  ArrowRight, UserCheck, Car, Bus, User, MapPin, Loader2,
  Filter, X, LocateFixed, Map as MapIcon, Grid, Building2,
  AlertTriangle, Palmtree, DollarSign, TrendingUp, Utensils, Home, Compass,
  ArrowLeft, Heart, Bookmark, Clock, Plane, Train, Bike, ChevronLeft, ChevronRight,
  ShoppingCart, HeartPulse, Layers, Calendar
} from 'lucide-react';
import { supabase } from '../lib/supabase'; 
import { useTenant } from '../contexts/TenantContext';
import { AuthModal } from '../components/AuthModal';

// --- IN-MEMORY CACHE ---
let globalExploreCache = {
  assets: null as any[] | null,
  posts: null as any[] | null,
  timestamp: 0
};

// --- HELPERS & CONSTANTS ---
const isVideoUrl = (url: string) => url?.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i) !== null;
const ACCRA_CENTER: [number, number] = [5.6037, -0.1870];

const MAP_STYLES = {
  light: { name: 'Minimal', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' },
  street: { name: 'Street', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' },
  satellite: { name: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' }
};

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 0.5 - Math.cos(dLat)/2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * (1 - Math.cos(dLon))/2;
  return R * 2 * Math.asin(Math.sqrt(a));
};

// --- DYNAMIC PIN GENERATOR ---
const createCustomIcon = (color: string, isSelected: boolean, avatarUrl?: string | null, isEvent?: boolean) => {
  const width = isSelected ? 48 : 36;
  const height = isSelected ? 56 : 44;

  const borderColor = isEvent ? '#fff' : color;
  
  const innerContent = avatarUrl 
    ? `<img src="${avatarUrl}" style="width: ${width-8}px; height: ${width-8}px; border-radius: 50%; object-fit: cover; border: 2px solid ${borderColor};" />`
    : `<div style="width: ${width-8}px; height: ${width-8}px; border-radius: 50%; background-color: ${color}; border: 2px solid #fff; display: flex; align-items: center; justify-content: center;"><span style="color: white; font-weight: bold; font-size: ${isSelected ? '14px' : '10px'};">🏢</span></div>`;

  const outerColor = isEvent ? '#f43f5e' : 'white'; 

  const html = `
    <div class="relative flex flex-col items-center drop-shadow-md transition-all duration-200">
      ${isEvent ? `<div class="absolute -inset-2 rounded-full bg-rose-500 opacity-50 animate-ping z-0 pointer-events-none"></div>` : ''}
      <div class="relative z-10 p-[2px] rounded-full flex justify-center items-center" style="background: ${outerColor};">
        ${innerContent}
      </div>
      <div class="relative z-10 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent -mt-[2px]" style="border-top-color: ${outerColor};"></div>
    </div>
  `;
  return L.divIcon({ className: 'bg-transparent border-none outline-none', html, iconSize: [width, height], iconAnchor: [width / 2, height] });
};

const createEmergencyIcon = (type: 'hospital' | 'police' | 'fire_station') => {
  const config = {
    hospital: { color: '#ef4444', emoji: '🏥' },
    police: { color: '#3b82f6', emoji: '👮' },
    fire_station: { color: '#f97316', emoji: '🚒' }
  }[type];

  const html = `
    <div style="display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
      <div style="background: ${config.color}; width: 32px; height: 32px; border-radius: 50%; display: flex; justify-content: center; align-items: center; border: 2px solid white; font-size: 16px;">
        ${config.emoji}
      </div>
      <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid ${config.color}; margin-top: -1px;"></div>
    </div>
  `;
  return L.divIcon({ className: 'bg-transparent border-none outline-none', html, iconSize: [32, 38], iconAnchor: [16, 38] });
};

const userLocationIcon = L.divIcon({
  className: 'bg-transparent border-none outline-none',
  html: `<div style="width: 20px; height: 20px; background: #3b82f6; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

const TOURIST_FILTERS = [
  { id: 'experiences', label: 'Experiences', icon: Palmtree },
  { id: 'stays', label: 'Stays & Rooms', icon: Home },
  { id: 'transport', label: 'Transport', icon: Bus },
  { id: 'dining', label: 'Dining', icon: Utensils },
  { id: 'supermarket', label: 'Supermarkets', icon: ShoppingCart },
  { id: 'pharmacy', label: 'Pharmacies', icon: HeartPulse },
  { id: 'luxury', label: 'Luxury', icon: Star },
  { id: 'budget', label: 'Budget', icon: DollarSign },
];

export default function Explore() {
  const { user, initializing } = useTenant();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'map' | 'grid'>('map');
  const [assets, setAssets] = useState<any[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<any[]>([]);
  const [explorePosts, setExplorePosts] = useState<any[]>([]);
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [savedPartnerIds, setSavedPartnerIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeFilter, setActiveFilter] = useState('all'); 
  const [touristFilter, setTouristFilter] = useState<string | null>(null); 
  const [showOnlyFollowing, setShowOnlyFollowing] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [isPriceSorted, setIsPriceSorted] = useState(false); 
  const [searchQuery, setSearchQuery] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [activeMapStyle, setActiveMapStyle] = useState<keyof typeof MAP_STYLES>('light');
  const [showLayers, setShowLayers] = useState(false);

  const [showEmergency, setShowEmergency] = useState(false); 
  const [isFetchingEmergency, setIsFetchingEmergency] = useState(false);
  const [emergencyPOIs, setEmergencyPOIs] = useState<any[]>([]);

  const [needsLocation, setNeedsLocation] = useState(false);
  const [draftLocation, setDraftLocation] = useState<[number, number] | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [detailModalAsset, setDetailModalAsset] = useState<any | null>(null);
  const [modalPage, setModalPage] = useState<1 | 2>(1);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  // NEW: Modal Image Gallery State
  const [modalImageIndex, setModalImageIndex] = useState(0);

  const [modalIsLiked, setModalIsLiked] = useState(false);
  const [modalIsSaved, setModalIsSaved] = useState(false);

  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [modalCategory, setModalCategory] = useState('all');
  const [modalTransit, setModalTransit] = useState<string | null>(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    if (detailModalAsset) {
      setModalPage(1);
      setModalSearchQuery('');
      setModalCategory('all');
      setModalTransit(null);
      setModalIsLiked(false);
      setModalIsSaved(false);
      setModalImageIndex(0); // Reset gallery index
    }
  }, [detailModalAsset]);

  // Consolidate all media for the active modal
  const modalMediaList = useMemo(() => {
    if (!detailModalAsset) return [];
    const media = detailModalAsset.post_media || [];
    const profileImages = [detailModalAsset.avatar_url, detailModalAsset.cover_url].filter(Boolean);
    const combined = [...media, ...profileImages];
    return combined.length > 0 ? combined : ['https://images.unsplash.com/photo-1528150242200-cb6d58cb0a54?q=80&w=800&auto=format&fit=crop'];
  }, [detailModalAsset]);

  const heatPoints = useMemo(() => {
    return filteredAssets
      .filter(asset => asset.latitude && asset.longitude)
      .map(asset => {
        const intensity = asset.is_verified ? 0.9 : 0.5;
        return [parseFloat(asset.latitude), parseFloat(asset.longitude), intensity] as [number, number, number];
      });
  }, [filteredAssets]);

  useEffect(() => {
    if (initializing) return;

    const initExplore = async () => {
      const now = Date.now();
      if (globalExploreCache.assets && globalExploreCache.posts && (now - globalExploreCache.timestamp < 300000)) {
        setAssets(globalExploreCache.assets);
        setExplorePosts(globalExploreCache.posts);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }

      try {
        let currentLat = ACCRA_CENTER[0]; 
        let currentLon = ACCRA_CENTER[1];

        if (user) {
          const { data: profile } = await supabase.from('profiles').select('latitude, longitude, user_role').eq('id', user.id).maybeSingle();
          
          if (profile && !profile.latitude && profile.user_role !== 'tourist') {
            setNeedsLocation(true);
          }
          
          if (profile?.latitude && profile?.longitude) {
            currentLat = parseFloat(profile.latitude);
            currentLon = parseFloat(profile.longitude);
          }

          const { data: followData } = await supabase.from('follows').select('following_id').eq('follower_id', user.id);
          if (followData) setFollowedIds(followData.map(f => f.following_id));

          const { data: savedData } = await supabase.from('saved_posts').select('post:posts(author_id)').eq('user_id', user.id);
          if (savedData) {
            const savedIds = savedData.map((s: any) => s.post?.author_id).filter(Boolean);
            setSavedPartnerIds([...new Set(savedIds)]);
          }
        }

        if (!globalExploreCache.assets || (now - globalExploreCache.timestamp >= 300000)) {
          const { data: algorithmicPartners } = await supabase.rpc('discover_partners', {
            user_lat: currentLat, user_lon: currentLon, max_distance_km: 100 
          });

          if (algorithmicPartners) {
            setAssets(algorithmicPartners);
            globalExploreCache.assets = algorithmicPartners;
          }

          const { data: postsData } = await supabase
            .from('posts')
            .select('id, media_urls, content, location, is_event, title, price, event_date, event_time, capacity, author_id, author:profiles(company, first_name, last_name, avatar_url, cover_url, is_verified, business_type, latitude, longitude, location)')
            .not('media_urls', 'is', null)
            .order('created_at', { ascending: false })
            .limit(30);

          if (postsData) {
            setExplorePosts(postsData);
            globalExploreCache.posts = postsData;
          }
          
          globalExploreCache.timestamp = Date.now();
        }

      } catch (err) { console.error(err); } finally { setIsLoading(false); }
    };
    initExplore();
  }, [user, initializing]);

  useEffect(() => {
    let results = [...assets];
    
    if (showOnlyFollowing && user) results = results.filter(a => followedIds.includes(a.id));
    if (showSavedOnly && user) results = results.filter(a => savedPartnerIds.includes(a.id));
    if (activeFilter !== 'all') results = results.filter(a => a.business_type?.toLowerCase() === activeFilter);
    
    if (touristFilter) {
      results = results.filter(a => {
        const type = a.business_type?.toLowerCase() || '';
        if (touristFilter === 'luxury') return type.includes('hotel') || type.includes('resort');
        if (touristFilter === 'budget') return type.includes('hostel') || type.includes('guest');
        if (touristFilter === 'dining') return type.includes('restaurant') || type.includes('cafe') || type.includes('food');
        if (touristFilter === 'stays') return type.includes('hotel') || type.includes('lodge');
        if (touristFilter === 'transport') return type.includes('transport') || type.includes('fleet') || type.includes('bus');
        if (touristFilter === 'experiences') return type.includes('guide') || type.includes('tour');
        if (touristFilter === 'supermarket') return type.includes('supermarket') || type.includes('grocery') || type.includes('mart');
        if (touristFilter === 'pharmacy') return type.includes('pharmacy') || type.includes('clinic') || type.includes('medical');
        return true;
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      results = results.filter(a => {
        const fullName = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase();
        return (
          a.company?.toLowerCase().includes(query) ||
          fullName.includes(query) ||
          a.business_type?.toLowerCase().includes(query)
        );
      });
    }

    if (isPriceSorted) {
      results.sort((a, b) => {
        const priceA = a.price || 0;
        const priceB = b.price || 0;
        return priceA - priceB;
      });
    }

    setFilteredAssets(results);
    if (selectedIndex !== null && !results.find(r => r.id === assets[selectedIndex]?.id)) {
      setIsPanelOpen(false); setSelectedIndex(null);
    }
  }, [activeFilter, touristFilter, showOnlyFollowing, showSavedOnly, searchQuery, isPriceSorted, assets, user, followedIds, savedPartnerIds, selectedIndex]);

  // --- SMART NEARBY MODAL SUGGESTIONS (FULLY FUNCTIONAL PAGE 2) ---
  const modalSuggestions = useMemo(() => {
    if (!detailModalAsset) return [];
    
    return explorePosts.filter((post: any) => {
      if (post.author_id === detailModalAsset.id) return false;

      const authorInfo = Array.isArray(post.author) ? post.author[0] : post.author;

      const postLat = authorInfo?.latitude;
      const postLon = authorInfo?.longitude;
      
      let isNearby = true;
      if (detailModalAsset.latitude && detailModalAsset.longitude && postLat && postLon) {
        isNearby = getDistance(detailModalAsset.latitude, detailModalAsset.longitude, postLat, postLon) <= 50;
      }

      // Robust Search Filter
      let matchesSearch = true;
      if (modalSearchQuery.trim()) {
        const q = modalSearchQuery.toLowerCase();
        matchesSearch = (
          authorInfo?.company?.toLowerCase().includes(q) || 
          authorInfo?.business_type?.toLowerCase().includes(q) ||
          post.content?.toLowerCase().includes(q) ||
          post.title?.toLowerCase().includes(q)
        );
      }

      // Robust Category Filter
      let matchesCat = true;
      if (modalCategory !== 'all') {
        const bt = authorInfo?.business_type?.toLowerCase() || '';
        const pt = post.title?.toLowerCase() || '';
        if (modalCategory === 'nature') matchesCat = bt.includes('park') || bt.includes('tour') || pt.includes('safari') || bt.includes('guide');
        else if (modalCategory === 'city attractions') matchesCat = bt.includes('hotel') || bt.includes('restaurant') || bt.includes('mall') || pt.includes('city');
        else if (modalCategory === 'ocean') matchesCat = bt.includes('beach') || bt.includes('resort') || pt.includes('water');
      }

      // Robust Transit Filter
      let matchesTransit = true;
      if (modalTransit) {
        const bt = authorInfo?.business_type?.toLowerCase() || '';
        if (modalTransit === 'plane') matchesTransit = bt.includes('air') || bt.includes('flight') || bt.includes('travel');
        else if (modalTransit === 'train') matchesTransit = bt.includes('train') || bt.includes('rail');
        else if (modalTransit === 'taxi') matchesTransit = bt.includes('taxi') || bt.includes('car') || bt.includes('fleet') || bt.includes('transport');
        else if (modalTransit === 'electric') matchesTransit = bt.includes('electric') || bt.includes('bike');
      }

      return isNearby && matchesSearch && matchesCat && matchesTransit;
    });
  }, [detailModalAsset, explorePosts, modalSearchQuery, modalCategory, modalTransit]);

  const loadEmergencyPOIs = async (mapObj: L.Map) => {
    if (!showEmergency || mapObj.getZoom() < 11) return;
    setIsFetchingEmergency(true);
    try {
      const bounds = mapObj.getBounds();
      const query = `
        [out:json][timeout:25];
        (
          node["amenity"="hospital"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
          node["amenity"="police"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
          node["amenity"="fire_station"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
        );
        out body;
      `;
      const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      const pois = data.elements.map((el: any) => ({
        id: el.id, lat: el.lat, lon: el.lon, type: el.tags.amenity,
        name: el.tags.name || `Local ${el.tags.amenity.replace('_', ' ')}`
      }));
      setEmergencyPOIs(pois);
    } catch (err) {
      console.error("Emergency fetch error");
    } finally {
      setIsFetchingEmergency(false);
    }
  };

  useEffect(() => {
    if (mapInstance && showEmergency) loadEmergencyPOIs(mapInstance);
    if (!showEmergency) setEmergencyPOIs([]);
  }, [showEmergency, mapInstance]);

  function MapController() {
    const map = useMapEvents({
      click(e) {
        if (needsLocation) {
          setDraftLocation([e.latlng.lat, e.latlng.lng]);
          map.flyTo(e.latlng, map.getZoom());
        } else {
          setIsPanelOpen(false);
          setSelectedIndex(null);
          setShowLayers(false);
        }
      },
      moveend(e) {
        if (showEmergency) loadEmergencyPOIs(e.target);
      }
    });
    useEffect(() => { if (map) setMapInstance(map); }, [map]);
    return null;
  }

  const handleLocateUser = () => {
    if (!mapInstance) return;
    setIsLocating(true);

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setUserLocation([lat, lng]);
          
          mapInstance.flyTo([lat, lng], 15, { duration: 1.5 });
          setIsLocating(false);
        },
        (error) => {
          console.error("Location error:", error);
          alert("Could not access your location. Please check your browser's GPS permissions.");
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
      setIsLocating(false);
    }
  };

  const handleSaveLocation = async () => {
    if (!draftLocation || !user) return;
    setIsSaving(true);
    try {
      await supabase.from('profiles').update({ latitude: draftLocation[0], longitude: draftLocation[1] }).eq('id', user.id);
      setNeedsLocation(false); navigate('/profile'); 
    } catch (err) { alert("Failed to save location."); } finally { setIsSaving(false); }
  };

  const handleSearchResultClick = (asset: any) => {
    const filterIdx = filteredAssets.findIndex(a => a.id === asset.id);
    if (filterIdx !== -1) {
      setActiveTab('map');
      setSelectedIndex(assets.findIndex(a => a.id === asset.id)); 
      setIsPanelOpen(true);
      if (mapInstance && asset.latitude && asset.longitude) mapInstance.flyTo([Number(asset.latitude), Number(asset.longitude)], 16, { duration: 1.5 });
    }
    setSearchQuery('');
  };

  const mapAssetToStandard = (asset: any) => {
    const eventPost = explorePosts.find(p => p.author_id === asset.id && p.is_event);
    const standardPost = explorePosts.find(p => p.author_id === asset.id);
    const activePost = eventPost || standardPost;
    
    return {
      ...asset,
      fullName: asset.company || `${asset.first_name || ''} ${asset.last_name || ''}`.trim(),
      latitude: asset.latitude,
      longitude: asset.longitude,
      postId: activePost?.id,
      post_media: activePost?.media_urls,
      is_event: activePost?.is_event,
      title: activePost?.title,
      price: activePost?.price,
      event_date: activePost?.event_date,
      event_time: activePost?.event_time,
      content: activePost?.content,
      location: activePost?.location || asset.location
    };
  };

  const mapPostToStandard = (post: any) => {
    const authorInfo = Array.isArray(post.author) ? post.author[0] : post.author;
    return {
      id: post.author_id,
      postId: post.id,
      fullName: authorInfo?.company || `${authorInfo?.first_name || ''} ${authorInfo?.last_name || ''}`.trim(),
      avatar_url: authorInfo?.avatar_url,
      cover_url: authorInfo?.cover_url,
      business_type: authorInfo?.business_type,
      is_verified: authorInfo?.is_verified,
      post_media: post.media_urls,
      latitude: authorInfo?.latitude,
      longitude: authorInfo?.longitude,
      location: post.location || authorInfo?.location,
      is_event: post.is_event,
      title: post.title,
      price: post.price,
      event_date: post.event_date,
      event_time: post.event_time,
      content: post.content
    };
  };

  const openMapAssetModal = (originalAssetIndex: number) => {
    const asset = assets[originalAssetIndex];
    setDetailModalAsset(mapAssetToStandard(asset));
    setModalPage(1);
  };

  const openGridPostModal = (postIndex: number) => {
    const post = explorePosts[postIndex];
    setDetailModalAsset(mapPostToStandard(post));
    setModalPage(1);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY === null) return;
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY - touchEndY;
    if (diff > 50 && modalPage === 1) setModalPage(2);
    if (diff < -50) {
      if (modalPage === 2) setModalPage(1);
      else setDetailModalAsset(null); 
    }
    setTouchStartY(null);
  };

  const handleBookNow = (asset: any) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    
    navigate('/bookings', { 
      state: { 
        openNewBooking: true, 
        prefillData: {
          id: asset.postId || asset.id,
          title: asset.title || asset.fullName || 'Selected Service',
          location: asset.location || 'Location TBD',
          price: asset.price || 99 
        } 
      } 
    });
  };

  const selectedMapAsset = selectedIndex !== null ? assets[selectedIndex] : null;

  if (initializing) {
    return (
      <div className="fixed inset-0 z-[99999] bg-[#e0e5ec] flex flex-col items-center justify-center">
        <div className="flex items-center gap-3 animate-pulse mb-6">
          <div className="w-8 h-8 rounded-full bg-[#1da1f2]"></div>
          <span className="text-3xl font-black text-slate-800 tracking-tight">TeamUp<span className="text-[#1da1f2]">.</span></span>
        </div>
        <Loader2 size={32} className="animate-spin text-[#1da1f2]" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 top-[64px] md:relative md:top-0 md:w-full md:h-[calc(100vh-6rem)] md:rounded-3xl overflow-hidden bg-[#e0e5ec] z-10 border border-white/50">
      
      {/* 1. TOP TOGGLE UI (Map vs Grid) */}
      {!needsLocation && (
        <div className="absolute top-6 left-0 right-0 z-[1000] flex justify-center pointer-events-none">
          <div className="bg-white/80 backdrop-blur-md p-1 rounded-full shadow-[0_8px_16px_rgba(0,0,0,0.1)] border border-white flex items-center pointer-events-auto">
            <button onClick={() => setActiveTab('map')} className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'map' ? 'bg-[#1da1f2] text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}><MapIcon size={16} /> Map</button>
            <button onClick={() => setActiveTab('grid')} className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'grid' ? 'bg-[#1da1f2] text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}><Grid size={16} /> Feed</button>
          </div>
        </div>
      )}

      {/* 2. GLOBAL SEARCH & TOURIST FILTERS */}
      {!needsLocation && (
        <div className="absolute top-20 left-0 right-0 z-[1001] pointer-events-none flex flex-col items-center w-full">
          <div className="max-w-md w-full px-4 pointer-events-auto relative">
            <div className="bg-white border border-slate-200 rounded-2xl flex items-center p-1.5 shadow-md relative z-20">
              <div className="pl-3 text-slate-400">{isLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}</div>
              <input 
                type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search places, hotels, tours..." className="w-full bg-transparent text-sm font-bold text-slate-800 p-2 focus:outline-none"
              />
              {searchQuery && <button onClick={() => setSearchQuery('')} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><X size={16} /></button>}
            </div>

            {searchQuery.trim() && (
              <div className="absolute top-full left-4 right-4 mt-2 bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden max-h-[50vh] overflow-y-auto z-10 animate-in fade-in slide-in-from-top-2 duration-200">
                {filteredAssets.length > 0 ? (
                  <div className="p-2 space-y-1">
                    {filteredAssets.map(asset => (
                      <div key={asset.id} onClick={() => handleSearchResultClick(asset)} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                          {asset.avatar_url ? <img src={asset.avatar_url} className="w-full h-full object-cover" /> : <Building2 size={16} className="text-slate-400" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-slate-900 truncate flex items-center gap-1">
                            {asset.company || `${asset.first_name} ${asset.last_name}`}
                            {asset.is_verified && <ShieldCheck size={12} className="text-[#1da1f2] shrink-0" />}
                          </h4>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">{asset.business_type}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <div className="p-6 text-center text-sm font-bold text-slate-400">No places found.</div>}
              </div>
            )}
          </div>

          <div className="w-full max-w-2xl px-4 mt-3 pointer-events-auto">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 snap-x">
              {TOURIST_FILTERS.map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setTouristFilter(touristFilter === filter.id ? null : filter.id)}
                  className={`snap-start shrink-0 flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs shadow-sm transition-all border ${
                    touristFilter === filter.id 
                      ? 'bg-slate-800 border-slate-800 text-white' 
                      : 'bg-white/90 backdrop-blur border-white text-slate-600 hover:bg-white'
                  }`}
                >
                  <filter.icon size={14} className={touristFilter === filter.id ? 'text-[#1da1f2]' : 'text-slate-400'} />
                  {filter.label}
                </button>
              ))}
              <button 
                onClick={() => setIsPriceSorted(!isPriceSorted)}
                className={`snap-start shrink-0 flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs shadow-sm transition-all border ${
                  isPriceSorted 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                    : 'bg-white/90 backdrop-blur border-white text-slate-600 hover:bg-white'
                }`}
              >
                <TrendingUp size={14} className={isPriceSorted ? 'text-emerald-500' : 'text-emerald-400'} /> Price: Low to High
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. TAB VIEWS */}
      
      {/* A. MAP VIEW */}
      <div className={`w-full h-full transition-opacity duration-300 ${activeTab === 'map' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <MapContainer center={ACCRA_CENTER} zoom={13} className="w-full h-full z-0" zoomControl={false} attributionControl={false}>
          <TileLayer url={MAP_STYLES[activeMapStyle].url} />
          <MapController />

          {userLocation && <Marker position={userLocation} icon={userLocationIcon} />}
          
          {showEmergency && emergencyPOIs.map((poi) => (
            <Marker key={poi.id} position={[poi.lat, poi.lon]} icon={createEmergencyIcon(poi.type)}>
              <Tooltip direction="top" offset={[0, -20]} className="font-bold rounded-lg shadow-lg border-0">{poi.name}</Tooltip>
            </Marker>
          ))}

          {heatPoints.length > 0 && <HeatmapLayer points={heatPoints} />}

          {filteredAssets.map((asset: any, index) => {
            const lat = Number(asset.latitude);
            const lon = Number(asset.longitude);
            if (isNaN(lat) || isNaN(lon)) return null;

            // Mark red if they have an active event
            const hasEvent = explorePosts.some(p => p.author_id === asset.id && p.is_event);
            const iconColor = hasEvent ? '#ef4444' : '#1da1f2';

            return (
              <Marker 
                key={`asset-${asset.id}`} 
                position={[lat, lon]} 
                icon={createCustomIcon(iconColor, selectedIndex === index, asset.avatar_url, hasEvent)}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e);
                    const originalIndex = assets.findIndex(a => a.id === asset.id);
                    setSelectedIndex(originalIndex);
                    setIsPanelOpen(true);
                    e.target._map.flyTo([lat, lon], 15, { duration: 1.2 });
                  }
                }}
              />
            );
          })}

          {draftLocation && <Marker position={draftLocation} icon={createCustomIcon('#14b8a6', true, null)} />}
          <ZoomControl position="bottomright" />
        </MapContainer>

        {/* MAP CONTROLS & FILTERS */}
        {!needsLocation && activeTab === 'map' && (
          <>
            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-[900] hidden md:flex flex-col gap-3 pointer-events-auto">
              
              <div className="bg-white/90 backdrop-blur-md border border-white rounded-2xl p-1.5 flex flex-col gap-1 shadow-[0_8px_16px_rgba(0,0,0,0.08)]">
                <button onClick={() => setShowSavedOnly(!showSavedOnly)} className={`p-3 rounded-xl transition-all ${showSavedOnly ? 'bg-amber-50 text-amber-500' : 'text-slate-400 hover:bg-slate-50'}`} title="Saved Places"><Bookmark size={22} /></button>
                <button onClick={() => setShowOnlyFollowing(!showOnlyFollowing)} className={`p-3 rounded-xl transition-all ${showOnlyFollowing ? 'bg-rose-50 text-rose-500' : 'text-slate-400 hover:bg-slate-50'}`} title="Network Only"><UserCheck size={22} /></button>
                <div className="h-px bg-slate-200 mx-2 my-1" />
                {[ { id: 'all', icon: Navigation }, { id: 'suv', icon: Car }, { id: 'bus', icon: Bus }, { id: 'guide', icon: User } ].map(f => (
                  <button key={f.id} onClick={() => setActiveFilter(f.id)} className={`p-3 rounded-xl flex flex-col items-center gap-1 transition-all ${activeFilter === f.id && !showOnlyFollowing && !showSavedOnly ? 'bg-blue-50 text-[#1da1f2]' : 'text-slate-400 hover:bg-slate-50'}`}><f.icon size={22} /></button>
                ))}
              </div>
              
              <div className="relative">
                <button 
                  onClick={() => setShowLayers(!showLayers)}
                  className={`bg-white/90 backdrop-blur-md border border-white p-3 rounded-2xl shadow-[0_8px_16px_rgba(0,0,0,0.08)] transition-all flex justify-center items-center ${showLayers ? 'text-[#1da1f2] bg-blue-50' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-500'}`}
                  title="Map Style"
                >
                  <Layers size={22} />
                </button>
                
                {showLayers && (
                  <div className="absolute left-full ml-3 top-0 bg-white/95 backdrop-blur-xl border border-slate-100 rounded-2xl p-2 flex flex-col gap-1 shadow-[0_20px_40px_rgba(0,0,0,0.15)] animate-in fade-in slide-in-from-left-2 w-32">
                    {(Object.keys(MAP_STYLES) as Array<keyof typeof MAP_STYLES>).map((styleKey) => (
                      <button 
                        key={styleKey} 
                        onClick={() => { setActiveMapStyle(styleKey); setShowLayers(false); }}
                        className={`p-2 rounded-xl text-xs font-bold text-left transition-all ${activeMapStyle === styleKey ? 'bg-[#1da1f2] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        {MAP_STYLES[styleKey].name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button 
                onClick={() => setShowEmergency(!showEmergency)}
                className={`border p-3 rounded-2xl shadow-[0_8px_16px_rgba(0,0,0,0.08)] transition-all flex justify-center items-center ${showEmergency ? 'bg-rose-500 border-rose-600 text-white animate-pulse' : 'bg-white/90 backdrop-blur-md border-white text-slate-500 hover:text-rose-500 hover:bg-rose-50'}`}
                title="Toggle Emergency Services"
              >
                {isFetchingEmergency ? <Loader2 size={22} className="animate-spin text-rose-500" /> : <AlertTriangle size={22} />}
              </button>

              <button 
                onClick={handleLocateUser} disabled={isLocating}
                className={`bg-white/90 backdrop-blur-md border border-white p-3 rounded-2xl text-slate-500 shadow-[0_8px_16px_rgba(0,0,0,0.08)] transition-all flex justify-center items-center ${isLocating ? 'text-blue-500 animate-pulse' : 'hover:bg-slate-50 hover:text-blue-500'}`}
                title="Find My Location"
              >
                {isLocating ? <Loader2 size={22} className="animate-spin" /> : <LocateFixed size={22} />}
              </button>
            </div>

            <div className="absolute bottom-24 left-0 right-0 px-4 md:hidden z-[900] pointer-events-none">
              <div className="max-w-xs mx-auto flex justify-center gap-2 pointer-events-auto">
                <button onClick={() => setShowEmergency(!showEmergency)} className={`h-12 px-5 border rounded-full shadow-lg flex items-center gap-2 text-xs font-black transition-colors ${showEmergency ? 'bg-rose-500 text-white border-rose-600 animate-pulse' : 'bg-white/90 backdrop-blur text-rose-500 border-white'}`}>
                  {isFetchingEmergency ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} />}
                  <span>SOS</span>
                </button>
                <button onClick={handleLocateUser} className="h-12 w-12 bg-white/90 backdrop-blur border border-white rounded-full shadow-lg flex items-center justify-center text-slate-700 hover:text-blue-500">
                  {isLocating ? <Loader2 size={18} className="animate-spin" /> : <LocateFixed size={18} />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* B. GRID VIEW */}
      <div className={`absolute inset-0 bg-[#e0e5ec] pt-40 px-2 pb-24 overflow-y-auto custom-scrollbar transition-opacity duration-300 ${activeTab === 'grid' ? 'opacity-100 z-20' : 'opacity-0 pointer-events-none z-0'}`}>
        {isLoading ? (
          <div className="flex justify-center mt-20"><Loader2 className="w-8 h-8 text-[#1da1f2] animate-spin" /></div>
        ) : explorePosts.length > 0 ? (
          <div className="grid grid-cols-3 gap-1 md:gap-2 max-w-4xl mx-auto">
            {explorePosts.map((post: any, index) => {
              const authorInfo = Array.isArray(post.author) ? post.author[0] : post.author;
              const imageUrl = post.media_urls[0];
              const authorName = authorInfo?.company || authorInfo?.first_name || "Partner";
              return (
                <div key={post.id} onClick={() => openGridPostModal(index)} className="relative aspect-square bg-slate-200 cursor-pointer group overflow-hidden shadow-[inset_2px_2px_4px_#a3b1c6,inset_-2px_-2px_4px_#ffffff] rounded-md md:rounded-xl">
                  {isVideoUrl(imageUrl) ? <video src={imageUrl} className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500" /> : <img src={imageUrl} className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500" />}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center">
                     <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white mb-2 flex items-center justify-center bg-slate-100">
                       {authorInfo?.avatar_url ? <img src={authorInfo.avatar_url} className="w-full h-full object-cover" /> : <Building2 size={14} className="text-slate-400" />}
                     </div>
                     <span className="text-white text-xs font-bold leading-tight truncate w-full">{authorName}</span>
                     {authorInfo?.is_verified && <ShieldCheck size={12} className="text-[#1da1f2] mt-1" />}
                  </div>
                </div>
              );
            })}
          </div>
        ) : <div className="text-center mt-20 text-slate-500 font-bold">No places discovered yet. Try adjusting your filters!</div>}
      </div>

      {/* --- OVERLAYS --- */}
      
      {/* ONBOARDING OVERLAY */}
      {needsLocation && (
        <div className="absolute inset-x-0 bottom-0 z-[1000] p-4 bg-gradient-to-t from-black/20 to-transparent pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto animate-in slide-in-from-bottom-6 duration-500">
            <div className="bg-white border border-teal-100 rounded-[2rem] p-8 shadow-2xl text-center">
              <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4"><MapPin size={32} className="text-teal-600" /></div>
              <h2 className="text-xl font-black text-slate-900 mb-2">Where is your business?</h2>
              <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">Tap exactly where your vehicles are stationed or where your office is located.</p>
              {draftLocation ? (
                <button onClick={handleSaveLocation} disabled={isSaving} className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg">
                  {isSaving ? <Loader2 className="animate-spin" /> : <>Confirm Location <ArrowRight size={18} /></>}
                </button>
              ) : <div className="py-4 px-6 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400 text-xs font-bold uppercase tracking-widest">Waiting for you to tap the map...</div>}
            </div>
          </div>
        </div>
      )}

      {/* FLOATING MAP ASSET CARD (Map Pin Click) */}
      {isPanelOpen && selectedMapAsset && activeTab === 'map' && (
        <div className="absolute bottom-28 md:bottom-6 left-0 right-0 px-4 z-[1000] pointer-events-none">
          <div className="max-w-sm mx-auto w-full pointer-events-auto animate-in slide-in-from-bottom-8 duration-400">
            <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] border border-white p-6 shadow-[0_20px_40px_rgba(0,0,0,0.15)]">
              <div className="flex justify-between items-start mb-6">
                <div className="flex gap-4 cursor-pointer group" onClick={() => { if(selectedIndex !== null) openMapAssetModal(selectedIndex) }}>
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 overflow-hidden shrink-0 border border-slate-100 flex items-center justify-center shadow-inner">
                    {selectedMapAsset.avatar_url ? <img src={selectedMapAsset.avatar_url} className="w-full h-full object-cover transition-transform group-hover:scale-110" /> : <User size={24} className="text-slate-400" />}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-black text-slate-900 leading-tight truncate group-hover:text-[#1da1f2] transition-colors">{selectedMapAsset.company || `${selectedMapAsset.first_name} ${selectedMapAsset.last_name}`}</h2>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">{selectedMapAsset.business_type || 'Local Business'}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Star size={12} className="fill-amber-400 text-amber-400" /><span className="text-xs font-black text-slate-800">4.9</span>
                      <span className="text-[10px] text-slate-400 font-bold ml-1">(24 reviews)</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsPanelOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"><X size={18} /></button>
              </div>
              <button onClick={() => { if(selectedIndex !== null) openMapAssetModal(selectedIndex) }} className="w-full py-4 bg-[#1da1f2] hover:bg-[#1a91da] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]">
                Explore Experience <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MARKETING BANNER FOR GUESTS */}
      {!user && !initializing && (
        <div className="absolute bottom-20 md:bottom-6 left-4 right-4 z-[900] pointer-events-none">
          <div className="max-w-md mx-auto w-full pointer-events-auto animate-in slide-in-from-bottom-8 duration-500">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 shadow-xl flex items-center justify-between border border-blue-400/50">
              <div className="pr-4">
                 <h4 className="font-black text-sm text-white flex items-center gap-1.5"><Compass size={16}/> Unlock Ghana</h4>
                 <p className="text-xs text-blue-100 mt-1 font-medium leading-tight">Save places, message partners, and book rides instantly.</p>
              </div>
              <button onClick={() => setIsAuthModalOpen(true)} className="px-5 py-2.5 bg-white text-blue-600 font-black rounded-xl text-xs shadow-md hover:bg-blue-50 transition-colors whitespace-nowrap active:scale-95">
                Sign In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. ASSET DETAIL QUICK-VIEW MODAL */}
      {detailModalAsset && (
        <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setDetailModalAsset(null)} />
          
          <div 
            onTouchStart={(e) => setTouchStartY(e.touches[0].clientY)}
            onTouchEnd={handleTouchEnd}
            className="w-full h-[90vh] sm:h-[80vh] sm:max-h-[800px] max-w-[400px] bg-slate-50 sm:rounded-[2.5rem] rounded-t-[2.5rem] relative z-10 overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom-full duration-300"
          >
            <div className="absolute top-4 left-4 right-4 z-50 flex justify-between items-center pointer-events-none">
               <button onClick={() => modalPage === 2 ? setModalPage(1) : setDetailModalAsset(null)} className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full text-white flex items-center justify-center hover:bg-white/40 transition-colors pointer-events-auto shadow-sm border border-white/20">
                 {modalPage === 2 ? <ArrowLeft size={20} /> : <X size={20} />}
               </button>
               <div className="flex gap-2">
                 <button onClick={() => setModalIsLiked(!modalIsLiked)} className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full text-white flex items-center justify-center hover:bg-white/40 transition-colors pointer-events-auto shadow-sm border border-white/20">
                   <Heart size={18} className={modalIsLiked ? "fill-rose-500 text-rose-500" : ""} />
                 </button>
                 <button onClick={() => setModalIsSaved(!modalIsSaved)} className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full text-white flex items-center justify-center hover:bg-white/40 transition-colors pointer-events-auto shadow-sm border border-white/20">
                   <Bookmark size={18} className={modalIsSaved ? "fill-indigo-500 text-indigo-500" : ""} />
                 </button>
               </div>
            </div>

            <div className="flex-1 w-full flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${(modalPage - 1) * 100}%)` }}>
              
              {/* --- PAGE 1: DETAILS --- */}
              <div className="w-full h-full flex-shrink-0 overflow-y-auto custom-scrollbar flex flex-col pb-6 relative bg-slate-50">
                
                {/* GALLERY HEADER */}
                <div className="h-[45%] min-h-[250px] w-full relative shrink-0 bg-slate-900 flex items-center justify-center overflow-hidden">
                  <img src={modalMediaList[modalImageIndex]} className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-125 pointer-events-none" />
                  
                  {isVideoUrl(modalMediaList[modalImageIndex]) ? (
                    <video src={modalMediaList[modalImageIndex]} autoPlay muted loop className="relative z-10 w-full h-full object-contain" />
                  ) : (
                    <img src={modalMediaList[modalImageIndex]} className="relative z-10 w-full h-full object-contain" />
                  )}
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-transparent to-black/30 pointer-events-none z-10" />
                  
                  {modalMediaList.length > 1 && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); setModalImageIndex(prev => prev === 0 ? modalMediaList.length - 1 : prev - 1); }} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors">
                         <ChevronLeft size={20} className="pr-0.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setModalImageIndex(prev => (prev + 1) % modalMediaList.length); }} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors">
                         <ChevronRight size={20} className="pl-0.5" />
                      </button>
                    </>
                  )}
                  
                  <div className="absolute bottom-4 left-12 right-12 bg-white/20 backdrop-blur-md p-2 rounded-2xl flex justify-center gap-2 overflow-x-auto scrollbar-hide shadow-lg border border-white/20 z-20">
                     {modalMediaList.slice(0, 3).map((url: string, i: number) => (
                       <div key={i} onClick={() => setModalImageIndex(i)} className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl shrink-0 overflow-hidden shadow-sm cursor-pointer transition-all ${modalImageIndex === i ? 'border-2 border-[#1da1f2] scale-105' : 'bg-slate-200 opacity-80 hover:opacity-100'}`}>
                         {isVideoUrl(url) ? <video src={url} className="w-full h-full object-cover" /> : <img src={url} className="w-full h-full object-cover"/>}
                       </div>
                     ))}
                     {modalMediaList.length > 3 && (
                       <div onClick={() => setModalImageIndex(3)} className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-slate-900/50 backdrop-blur shrink-0 flex items-center justify-center text-white font-bold shadow-sm relative overflow-hidden cursor-pointer ${modalImageIndex >= 3 ? 'border-2 border-[#1da1f2] scale-105' : 'opacity-80 hover:opacity-100'}`}>
                         <img src={modalMediaList[3]} className="absolute inset-0 w-full h-full object-cover opacity-50"/>
                         <span className="relative z-10 text-xs">+{modalMediaList.length - 3}</span>
                       </div>
                     )}
                  </div>
                </div>

                <div className="px-5 pt-5 bg-slate-50 flex-1 rounded-t-3xl -mt-4 relative z-20 flex flex-col shadow-[0_-10px_20px_rgba(0,0,0,0.1)]">
                  <div className="flex justify-between items-start mb-1">
                    <div className="min-w-0 max-h-7 pr-4">
                      <h1 className="text-xl sm:text-2xl font-black text-slate-900 truncate">
                        {detailModalAsset.is_event && detailModalAsset.title ? detailModalAsset.title : detailModalAsset.fullName}
                      </h1>
                      <p className="text-slate-500 font-medium text-sm mt-1">{detailModalAsset.is_event ? 'Bookable Event/Trip' : (detailModalAsset.business_type || 'National Park')}</p>
                    </div>
                    {detailModalAsset.price && (
                      <div className="text-right shrink-0">
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900">₵{detailModalAsset.price}</h2>
                        <p className="text-slate-500 font-bold text-[10px] sm:text-xs mt-1">Tickets</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-3 text-slate-700">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                        <MapPin size={16} className="text-slate-600"/>
                      </div>
                      <span className="font-bold text-sm sm:text-[15px] truncate">{detailModalAsset.location || 'Location TBD'}</span>
                    </div>

                    {detailModalAsset.is_event ? (
                       <div className="flex items-center justify-between gap-4 text-slate-700">
                         <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 text-indigo-500">
                             <Calendar size={16} />
                           </div>
                           <div>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Date</p>
                              <span className="font-bold text-sm sm:text-[15px]">{detailModalAsset.event_date || 'TBA'}</span>
                           </div>
                         </div>
                         {detailModalAsset.event_time && <span className="text-[10px] sm:text-xs font-bold text-slate-400">{detailModalAsset.event_time}</span>}
                       </div>
                    ) : (
                      <div className="flex items-center justify-between gap-4 text-slate-700">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                            <Clock size={16} className="text-slate-600"/>
                          </div>
                          <div>
                             <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Period</p>
                             <span className="font-bold text-sm sm:text-[15px]">08.00 AM</span>
                          </div>
                        </div>
                        <span className="text-[10px] sm:text-xs font-bold text-slate-400">Lifting stroke</span>
                      </div>
                    )}
                  </div>

                  {/* NAVIGATE TO PAGE 2 BUTTON */}
                  <div className="mt-auto mb-4 flex justify-center">
                    <button onClick={() => setModalPage(2)} className="w-12 h-12 bg-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] rounded-full text-slate-800 flex items-center justify-center border border-slate-200 active:scale-95 transition-all hover:bg-slate-50 animate-bounce">
                      <ChevronRight size={28} className="ml-0.5" />
                    </button>
                  </div>

                  <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-200 h-20 sm:h-24 flex items-center justify-center p-6 cursor-pointer hover:bg-slate-300 transition-colors" onClick={() => handleBookNow(detailModalAsset)}>
                    <div className="absolute inset-0 opacity-40 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
                    <button className="relative z-10 w-full py-3 sm:py-5 bg-[#222] hover:bg-black text-white rounded-full font-bold text-sm sm:text-[15px] flex items-center justify-center gap-2 shadow-xl transition-all">
                      {detailModalAsset.is_event ? 'Book Seat Now' : 'Book Now'} <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* --- PAGE 2: DISCOVER --- */}
              <div className="w-full h-full flex-shrink-0 bg-slate-50 overflow-y-auto custom-scrollbar pt-16 px-5 pb-6 flex flex-col">
                <div className="flex justify-between items-start mb-6">
                   <h2 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">Discover<br/>interesting places</h2>
                   <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-slate-200 shrink-0 border border-slate-200 shadow-sm cursor-pointer" onClick={() => navigate('/profile')}>
                     {user?.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover"/> : <User className="m-2.5 sm:m-3 text-slate-400" size={20}/>}
                   </div>
                </div>

                <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 flex items-center shadow-sm border border-slate-100 mb-6">
                   <Search size={18} className="text-slate-400 ml-2" />
                   <input 
                     type="text" 
                     value={modalSearchQuery}
                     onChange={(e) => setModalSearchQuery(e.target.value)}
                     placeholder="Search nearby places..." 
                     className="flex-1 bg-transparent px-3 outline-none text-xs sm:text-sm font-medium text-slate-700"
                   />
                   <Filter size={18} className="text-slate-400 mr-2" />
                </div>

                <h3 className="text-base sm:text-lg font-black text-slate-900 mb-3">Popular nearby</h3>
                
                <div className="flex gap-4 sm:gap-6 overflow-x-auto scrollbar-hide mb-4 text-xs sm:text-sm font-bold border-b border-slate-200">
                  {['all', 'nature', 'city attractions', 'ocean'].map(cat => (
                     <button key={cat} onClick={() => setModalCategory(cat)} className={`pb-2 sm:pb-3 capitalize shrink-0 ${modalCategory === cat ? 'border-b-2 border-rose-500 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
                        {cat}
                     </button>
                  ))}
                </div>

                <div className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide mb-6 pb-2 -mx-5 px-5 snap-x">
                  {modalSuggestions.length > 0 ? modalSuggestions.map((post: any) => (
                    <div key={post.id} className="w-40 sm:w-48 shrink-0 snap-start bg-white p-2.5 sm:p-3 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 cursor-pointer" onClick={() => {
                        const idx = explorePosts.findIndex(p => p.id === post.id);
                        if(idx !== -1) openGridPostModal(idx);
                    }}>
                      <div className="w-full h-32 sm:h-40 rounded-xl sm:rounded-2xl overflow-hidden mb-2 sm:mb-3 relative">
                        {isVideoUrl(post.media_urls[0]) ? <video src={post.media_urls[0]} className="w-full h-full object-cover"/> : <img src={post.media_urls[0]} className="w-full h-full object-cover"/>}
                        <button className="absolute top-2 right-2 w-7 h-7 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-rose-500 transition-colors"><Heart size={12}/></button>
                      </div>
                      <h4 className="text-sm font-black text-slate-900 truncate">{Array.isArray(post.author) ? post.author[0]?.company : post.author?.company || 'Local Attraction'}</h4>
                      <p className="text-[10px] sm:text-xs text-slate-400 font-bold flex items-center gap-1 mt-1 truncate"><MapPin size={10}/> Nearby Area</p>
                    </div>
                  )) : (
                    <div className="w-full text-center py-4 sm:py-6 text-slate-400 font-bold text-xs sm:text-sm">No nearby places found matching your filters.</div>
                  )}
                </div>

                <h3 className="text-base sm:text-lg font-black text-slate-900 mb-4">Traffic travel</h3>
                <div className="flex justify-between mb-auto pb-4">
                  {[
                    { id: 'plane', icon: Plane, label: 'Plane', color: 'blue' },
                    { id: 'train', icon: Train, label: 'Train', color: 'emerald' },
                    { id: 'taxi', icon: Car, label: 'Taxi', color: 'amber' },
                    { id: 'electric', icon: Bike, label: 'Electric', color: 'rose' }
                  ].map(t => (
                    <div key={t.id} onClick={() => setModalTransit(modalTransit === t.id ? null : t.id)} className="flex flex-col items-center gap-1.5 sm:gap-2 cursor-pointer group">
                      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-sm transition-all ${modalTransit === t.id ? `bg-slate-800 text-white shadow-md scale-110` : `bg-${t.color}-50 text-${t.color}-500 group-hover:scale-105`}`}>
                         <t.icon size={20} className="sm:w-6 sm:h-6"/>
                      </div>
                      <span className={`text-[10px] sm:text-xs font-bold transition-colors ${modalTransit === t.id ? 'text-slate-900' : 'text-slate-600'}`}>{t.label}</span>
                    </div>
                  ))}
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* RENDER THE AUTH MODAL */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} message="Join TeamUp" />
    </div>
  );
}