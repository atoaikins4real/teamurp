import { useState, useEffect } from 'react';
import { 
  CheckCircle2, X, Loader2
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useTenant } from '../contexts/TenantContext'; // <-- Added to get the Vendor's ID

// --- SHARED PROFILE SERVICES (We will fetch these from the DB later) ---
export const PROFILE_SERVICES = [
  { id: 'srv-1', title: 'Kakum Canopy Walk & Castle Tour', type: 'guide', price: 450, location: 'Cape Coast' },
  { id: 'srv-2', title: 'Mole Safari Experience (2 Days)', type: 'stay', price: 2100, location: 'Savannah Region' },
  { id: 'srv-3', title: '4x4 Off-Road SUV Rental', type: 'transport', price: 800, location: 'Accra' }
];

export default function Bookings() {
  const location = useLocation();
  const { user } = useTenant(); // Grab the logged-in vendor
  
  // --- STATE ---
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Loading state for initial fetch
  const [isSaving, setIsSaving] = useState(false);  // Loading state for form submission
  
  const [activeTab, setActiveTab] = useState('upcoming');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    serviceId: '',
    serviceName: '',
    date: '',
    time: '',
    guestCount: 1,
    specialRequests: ''
  });

  // 1. FETCH REAL BOOKINGS ON LOAD
  useEffect(() => {
    const fetchBookings = async () => {
      if (!user) return;
      setIsLoading(true);

      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('vendor_id', user.id) // Only get bookings for this specific vendor
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching bookings:", error);
      } else if (data) {
        setBookings(data);
      }
      
      setIsLoading(false);
    };

    fetchBookings();
  }, [user]);

  // --- ROUTER LISTENER (Catches Homepage Page "Book Now" click) ---
  useEffect(() => {
    if (location.state?.openNewBooking) {
      setIsModalOpen(true);
      if (location.state?.prefillData) {
        setFormData(prev => ({
          ...prev,
          serviceId: location.state.prefillData.id,
          serviceName: location.state.prefillData.title
        }));
      }
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // --- HANDLERS ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'serviceId') {
      const selectedService = PROFILE_SERVICES.find(s => s.id === value);
      setFormData({
        ...formData,
        serviceId: value,
        serviceName: selectedService ? selectedService.title : ''
      });
      return;
    }

    setFormData({ ...formData, [name]: value });
  };

  // 2. PUSH NEW BOOKING TO SUPABASE
  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSaving(true);
    const selectedService = PROFILE_SERVICES.find(s => s.id === formData.serviceId);
    const calculatedTotal = selectedService ? (selectedService.price * formData.guestCount) : 0;
    
    // Prepare the payload exactly as your schema demands
    const payload = {
      vendor_id: user.id,
      // We leave tourist_id blank here because the vendor is entering it manually
      asset_id: formData.serviceId || null, 
      customer_name: formData.customerName,
      customer_email: formData.customerEmail,
      customer_phone: formData.customerPhone,
      booking_date: formData.date,
      booking_time: formData.time || null,
      guest_count: formData.guestCount,
      special_requests: formData.specialRequests,
      total_amount: calculatedTotal,
      status: 'confirmed'
    };

    const { data, error } = await supabase
      .from('bookings')
      .insert(payload)
      .select() // Return the newly created row
      .single();

    if (error) {
      console.error("Error saving booking:", error);
      alert("Failed to save booking. Please try again.");
    } else if (data) {
      // Add the new booking to the top of our local state so it appears instantly
      setBookings([data, ...bookings]);
      setIsModalOpen(false);
      
      // Reset form
      setFormData({
        customerName: '', customerEmail: '', customerPhone: '', 
        serviceId: '', serviceName: '', date: '', time: '', 
        guestCount: 1, specialRequests: ''
      });
      
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
    }
    
    setIsSaving(false);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'confirmed': return { label: 'Confirmed', color: 'text-blue-600', bg: 'bg-blue-50', step: 2 };
      case 'en_route': return { label: 'Active', color: 'text-indigo-600', bg: 'bg-indigo-50', step: 3 };
      default: return { label: 'Pending', color: 'text-slate-500', bg: 'bg-slate-50', step: 0 };
    }
  };

  return (
    <div className="space-y-6 pb-24 max-w-[800px] mx-auto bg-white min-h-screen">
      
      {/* --- NOTIFICATION TOAST --- */}
      {showNotification && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-6 py-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-4">
          <CheckCircle2 size={20} className="text-emerald-400" />
          <div>
            <p className="font-semibold text-sm">Booking Confirmed</p>
            <p className="text-xs text-slate-300">Operations pipeline updated.</p>
          </div>
        </div>
      )}

      {/* --- HEADER --- */}
      <div className="flex justify-between items-center mb-8 px-4 pt-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Bookings</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your active operations</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-slate-900 text-white text-sm font-medium py-2.5 px-5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          + New Booking
        </button>
      </div>

      {/* --- TAB NAVIGATION --- */}
      <div className="flex border-b border-slate-200 px-4 mb-6">
        {['upcoming', 'past', 'cancelled'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`capitalize pb-3 px-4 text-sm font-medium transition-colors relative ${
              activeTab === tab 
                ? 'text-slate-900' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
            )}
          </button>
        ))}
      </div>

      {/* --- BOOKING LIST --- */}
      <div className="space-y-4 px-4">
        {isLoading ? (
           <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-[#1da1f2]" /></div>
        ) : bookings.length === 0 ? (
           <div className="text-center p-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
             <p className="text-sm font-bold text-slate-500">No bookings yet.</p>
           </div>
        ) : (
          bookings.map((booking) => {
            const config = getStatusConfig(booking.status);
            const isExpanded = expandedId === booking.id;
            
            // We generate an avatar dynamically based on their real name now!
            const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(booking.customer_name || 'User')}&background=f1f5f9&color=0f172a`;
            
            // Find the service name since we only saved the asset_id in the DB
            const serviceName = PROFILE_SERVICES.find(s => s.id === booking.asset_id)?.title || 'Custom Service';
            const location = PROFILE_SERVICES.find(s => s.id === booking.asset_id)?.location || 'TBD';

            return (
              <div 
                key={booking.id} 
                className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors cursor-pointer shadow-sm"
                onClick={() => setExpandedId(isExpanded ? null : booking.id)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex gap-4 items-center">
                    <img src={avatarUrl} alt="Customer" className="w-10 h-10 rounded-full bg-slate-100" />
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{booking.customer_name}</h3>
                      <p className="text-sm text-slate-500 mt-0.5">{serviceName}</p>
                    </div>
                  </div>
                  <div className={`px-2.5 py-1 rounded-md text-xs font-medium ${config.bg} ${config.color}`}>
                    {config.label}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-2 gap-4 animate-in fade-in">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Date & Time</p>
                      <p className="text-sm font-medium text-slate-900">{booking.booking_date} at {booking.booking_time}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Location</p>
                      <p className="text-sm font-medium text-slate-900">{location}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Contact</p>
                      <p className="text-sm font-medium text-slate-900">{booking.customer_phone}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Total Value</p>
                      <p className="text-sm font-medium text-slate-900">₵{booking.total_amount}</p>
                    </div>
                    {booking.special_requests && (
                      <div className="col-span-2">
                        <p className="text-xs text-slate-500 mb-1">Notes</p>
                        <p className="text-sm font-medium text-slate-900 bg-slate-50 p-2 rounded">{booking.special_requests}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* --- CLEAN NEW BOOKING MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] shadow-2xl animate-in zoom-in-95">
            
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Create Booking</h2>
                <p className="text-sm text-slate-500">Enter client and service details</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 bg-slate-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form id="booking-form" onSubmit={handleCreateBooking} className="space-y-6">
                
                {/* Client Section */}
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">1. Client Details</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1.5">Full Name</label>
                      <input required name="customerName" value={formData.customerName} onChange={handleInputChange} type="text" className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg px-4 py-2.5 focus:bg-white focus:border-slate-400 focus:ring-0 outline-none transition-colors" placeholder="e.g. Jane Doe" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1.5">Email</label>
                        <input name="customerEmail" value={formData.customerEmail} onChange={handleInputChange} type="email" className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg px-4 py-2.5 focus:bg-white focus:border-slate-400 focus:ring-0 outline-none transition-colors" placeholder="jane@example.com" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1.5">Phone Number</label>
                        <input required name="customerPhone" value={formData.customerPhone} onChange={handleInputChange} type="tel" className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg px-4 py-2.5 focus:bg-white focus:border-slate-400 focus:ring-0 outline-none transition-colors" placeholder="+233 55 000 0000" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Service Section */}
                <div className="pt-2 border-t border-slate-100">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 mt-4">2. Service Details</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1.5">Select Profile Service</label>
                      <select required name="serviceId" value={formData.serviceId} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg px-4 py-2.5 focus:bg-white focus:border-slate-400 focus:ring-0 outline-none transition-colors appearance-none cursor-pointer">
                        <option value="" disabled>Choose a service...</option>
                        {PROFILE_SERVICES.map(service => (
                          <option key={service.id} value={service.id}>{service.title} - ₵{service.price}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-1">
                        <label className="text-sm font-medium text-slate-700 block mb-1.5">Date</label>
                        <input required name="date" value={formData.date} onChange={handleInputChange} type="date" className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg px-4 py-2.5 focus:bg-white focus:border-slate-400 focus:ring-0 outline-none transition-colors" />
                      </div>
                      <div className="col-span-1">
                        <label className="text-sm font-medium text-slate-700 block mb-1.5">Time</label>
                        <input required name="time" value={formData.time} onChange={handleInputChange} type="time" className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg px-4 py-2.5 focus:bg-white focus:border-slate-400 focus:ring-0 outline-none transition-colors" />
                      </div>
                      <div className="col-span-1">
                        <label className="text-sm font-medium text-slate-700 block mb-1.5">Guests</label>
                        <input required name="guestCount" value={formData.guestCount} onChange={handleInputChange} type="number" min="1" className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg px-4 py-2.5 focus:bg-white focus:border-slate-400 focus:ring-0 outline-none transition-colors" />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1.5">Notes / Special Requests (Optional)</label>
                      <textarea name="specialRequests" value={formData.specialRequests} onChange={handleInputChange} rows={2} className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg px-4 py-2.5 focus:bg-white focus:border-slate-400 focus:ring-0 outline-none transition-colors" placeholder="Dietary requirements, pickup details..."></textarea>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                Cancel
              </button>
              <button 
                type="submit" 
                form="booking-form" 
                disabled={isSaving}
                className="px-5 py-2.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-70"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                Confirm Booking
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}