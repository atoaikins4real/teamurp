import { Link } from 'react-router-dom';

function Settings() {
  return (
    <div className="w-full h-screen bg-[#e0e5ec] font-sans p-10 flex flex-col items-center justify-center">
      
      <div className="w-full max-w-2xl bg-[#e0e5ec] rounded-3xl p-10 shadow-[9px_9px_16px_rgb(163,177,198,0.6),-9px_-9px_16px_rgba(255,255,255,0.5)] flex flex-col gap-8">
        
        <div className="flex justify-between items-center border-b-2 border-slate-300/50 pb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-700 tracking-tighter">Settings</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Manage your OpsHub Profile</p>
          </div>
          
          {/* Neumorphic Back Button */}
          <Link to="profile" className="px-6 py-3 rounded-xl bg-[#e0e5ec] text-slate-600 font-bold text-sm tracking-wider
                           shadow-[5px_5px_10px_#a3b1c6,-5px_-5px_10px_#ffffff] hover:text-teal-500 transition-colors active:shadow-[inset_3px_3px_6px_rgba(0,0,0,0.2)]">
            ← Back to Profile
          </Link>
        </div>

        <div className="space-y-6">
          <p className="text-slate-500 font-medium">Your settings configuration will go here...</p>
          {/* We can add Neumorphic toggle switches and profile inputs here later! */}
        </div>

      </div>
    </div>
  );
}

export default Settings;