import React, { useState, useEffect } from 'react';

interface SlideshowLayoutProps {
  children: React.ReactNode;
}

// Your public images for the slideshow
const images = ['/lg1.jpg', '/lg2.jpg', '/lg3.jpg'];

export const SlideshowLayout: React.FC<SlideshowLayoutProps> = ({ children }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 8000); // Increased to 8 seconds to let the soothing zoom breathe
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full h-screen relative font-sans overflow-hidden bg-slate-900">
      
      {/* Soothing Ken Burns Slideshow effect */}
      {images.map((img, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-all duration-[4000ms] ease-in-out transform origin-center ${
            index === currentImageIndex 
              ? 'opacity-100 scale-105' // Fades in and gently zooms slowly
              : 'opacity-0 scale-100'   // Fades out and resets
          }`}
          style={{
            backgroundImage: `url(${img})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      ))}

      {/* Light Glass Effect Overlay (Corrected Tailwind syntax) */}
      <div className="absolute inset-0 bg-black/05  z-10" />
      
      {/* Header Area: Blue Dot Accent + TeamUp t2 Logo */}
      <div className="absolute top-8 left-6 md:left-12 lg:left-24 z-20 flex items-center gap-1">
        <div className="w-4 h-4 rounded-full bg-[#1da1f2] shadow-[0_0_15px_rgba(29,161,242,0.6)]"></div>
        <img src="/t2.png" alt="TeamUp Logo" className="h-16 brightness-[1.4]" />
      </div>

      {/* Main Content Area: Centered on Mobile, Aligned Left on Desktop */}
      <main className="relative z-20 flex-1 w-full h-full flex items-center justify-center lg:justify-start pt-24 pb-20 overflow-y-auto">
        <div className="w-full max-w-[1400px] mx-auto px-4 md:px-12 lg:px-24 flex items-center h-full">
          {children}
        </div>
      </main>
    </div>
  );
};