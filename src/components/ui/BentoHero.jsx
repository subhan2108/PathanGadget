import React from 'react';
import { useProducts } from '../../hooks/useProducts';
import { ArrowUpRight, Heart, Star, Music } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function BentoHero() {
  const { products, loading } = useProducts({}, 'featured');
  const navigate = useNavigate();

  // Extract a few products for the hero images. 
  // Fallback to Unsplash images if products are missing or loading.
  const mainProduct = products?.[0] || {};
  const earbudProduct = products?.[1] || {};
  const vrProduct = products?.[2] || {};
  const moreProducts = products?.slice(3, 6) || [];

  return (
    <section className="bg-[var(--primary-bg)] px-4 md:px-8 py-4 md:py-8 lg:py-6 w-full min-h-[calc(100vh-80px)] flex items-stretch">
      <div className="w-full max-w-[1440px] mx-auto flex flex-col lg:flex-row gap-4 flex-1">

        {/* LEFT SIDE (Main Hero + Bottom Row) */}
        <div className="flex flex-col gap-4 lg:w-[78%] h-auto lg:h-full">

          {/* MAIN HERO CARD */}
          <div className="flex-1 bg-[var(--white)] border border-[var(--border)] rounded-[2rem] p-6 md:p-8 xl:p-10 relative overflow-hidden flex flex-col md:flex-row items-center shadow-sm min-h-[350px]">
            {/* Ambient Background Blur */}
            <div className="absolute top-0 right-0 w-72 h-72 bg-[var(--accent)]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="z-10 flex-1 w-full">
              <div className="inline-flex items-center gap-2 bg-[var(--primary-bg)] px-3 py-1.5 rounded-full mb-4 border border-[var(--border)] text-[var(--text-secondary)] text-xs font-medium">
                <Music size={14} className="text-[var(--accent)]" />
                <span>Next-Gen Tech is Here</span>
              </div>

              <h1 className="text-4xl md:text-5xl xl:text-7xl font-bold text-[var(--text-primary)] leading-tight mb-4 tracking-tight">
                Experience <br /> Premium Gadgets.
              </h1>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-4 border-l-2 border-[var(--border)] pl-4">
                  <div>
                    <h3 className="text-[var(--text-primary)] font-semibold mb-1 text-sm">Crystal Clear</h3>
                    <p className="text-[var(--text-secondary)] text-xs max-w-[200px]">Making your tech dreams come true with top-tier quality.</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <button
                  onClick={() => navigate('/products')}
                  className="bg-[#D1FF4D] hover:bg-[#bce640] text-[var(--text-primary)] px-5 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                >
                  View All Products
                  <div className="bg-black text-white w-7 h-7 flex items-center justify-center rounded-full shrink-0">
                    <ArrowUpRight size={14} />
                  </div>
                </button>
              </div>

              {/* Socials */}
              <div className="mt-8 flex items-center gap-3 text-[var(--text-secondary)]">
                <span className="text-xs font-medium">Follow us on:</span>
                <div className="flex gap-2">
                  <div className="p-1.5 bg-[var(--neutral-bg)] rounded-full hover:text-[var(--cta)] cursor-pointer transition-colors border border-[var(--border)]"><i className="bi bi-twitter" style={{ fontSize: '14px' }}></i></div>
                  <div className="p-1.5 bg-[var(--neutral-bg)] rounded-full hover:text-[var(--cta)] cursor-pointer transition-colors border border-[var(--border)]"><i className="bi bi-instagram" style={{ fontSize: '14px' }}></i></div>
                  <div className="p-1.5 bg-[var(--neutral-bg)] rounded-full hover:text-[var(--cta)] cursor-pointer transition-colors border border-[var(--border)]"><i className="bi bi-linkedin" style={{ fontSize: '14px' }}></i></div>
                </div>
              </div>
            </div>

            {/* Main Product Image */}
            <div className="flex-1 w-full mt-6 md:mt-0 relative z-10 flex justify-center items-center h-full min-h-[200px]">
              {loading ? (
                <div className="w-48 h-48 bg-[var(--neutral-bg)] animate-pulse rounded-full" />
              ) : (
                <img
                  src={mainProduct.image || "https://images.unsplash.com/photo-1546868871-7041f2a55e12?q=80&w=800&auto=format&fit=crop"}
                  alt={mainProduct.name || "Main Product"}
                  className="w-full max-w-[300px] xl:max-w-[400px] object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500 rounded-2xl"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 h-auto shrink-0">

            {/* More Products Card */}
            <div className="bg-[var(--white)] border border-[var(--border)] rounded-[2rem] p-6 relative flex flex-col justify-between shadow-sm h-full min-h-[220px]">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-[var(--text-primary)] font-semibold text-lg">More Products</h3>
                  <p className="text-[var(--text-secondary)] text-sm">460 plus items.</p>
                </div>
                <div className="bg-[var(--primary-bg)] p-2 rounded-full cursor-pointer hover:bg-[var(--border)] transition-colors text-red-500">
                  <Heart size={16} className="fill-red-500" />
                </div>
              </div>
              <div className="flex gap-2 h-[80px]">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex-1 h-full bg-[var(--neutral-bg)] rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-[var(--accent)] transition-all">
                    <img
                      src={moreProducts[i]?.image || `https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=200&auto=format&fit=crop&${i}`}
                      alt="Product Thumbnail"
                      className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity mix-blend-multiply"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Downloads / Happy Customers Card */}
            <div className="hidden md:flex flex-col items-center justify-center text-center bg-[var(--white)] border border-[var(--border)] rounded-[2rem] p-6 shadow-sm h-full min-h-[220px]">
              <div className="flex -space-x-4 mb-4">
                {[1, 2, 3].map(i => (
                  <img key={i} className="w-12 h-12 rounded-full border-2 border-white z-10 shadow-sm" src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="Avatar" />
                ))}
              </div>
              <div className="bg-[var(--cta)] w-[85%] max-w-[220px] mx-auto rounded-2xl py-3 mb-3 shadow-[0_4px_14px_rgba(0,119,255,0.35)] shrink-0">
                <h2 className="text-white font-bold text-2xl mb-0">5m+</h2>
                <p className="text-white/90 text-xs font-medium">Downloads</p>
              </div>
              <div className="flex items-center gap-1 text-[var(--text-secondary)] text-sm font-medium bg-[var(--neutral-bg)] px-3 py-1 rounded-full border border-[var(--border)]">
                <Star size={14} className="text-[#FFB800] fill-[#FFB800]" />
                4.6 reviews
              </div>
            </div>

            {/* Trending Card */}
            <div className="hidden md:block bg-[var(--white)] border border-[var(--border)] rounded-[2rem] p-6 relative overflow-hidden group cursor-pointer shadow-sm h-full min-h-[220px]" onClick={() => navigate('/products')}>
              <div className="inline-flex items-center gap-1 bg-orange-50 px-2 py-1 rounded-md mb-2 border border-orange-100 text-xs text-orange-600 font-medium">
                <span>🔥 Popular</span>
              </div>
              <h3 className="text-[var(--text-primary)] font-semibold text-lg max-w-[150px] relative z-10 leading-tight">Listening Has Been Released</h3>

              <div className="absolute -right-4 -bottom-4 w-32 h-32 xl:w-40 xl:h-40">
                <img
                  src={products?.[4]?.image || "https://images.unsplash.com/photo-1595225476474-87563907a212?q=80&w=400&auto=format&fit=crop"}
                  alt="Trending"
                  className="w-full h-full object-contain drop-shadow-xl group-hover:scale-110 transition-transform duration-500 rounded-full mix-blend-multiply opacity-80"
                />
              </div>

              <div className="absolute top-6 right-6 bg-[var(--neutral-bg)] border border-[var(--border)] w-9 h-9 flex items-center justify-center rounded-full group-hover:bg-[var(--cta)] group-hover:text-white group-hover:border-[var(--cta)] transition-colors z-20 text-[var(--text-primary)]">
                <ArrowUpRight size={16} />
              </div>

              <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 text-[var(--text-secondary)] text-xs font-medium bg-[var(--neutral-bg)] px-2 py-1 rounded-full border border-[var(--border)]">
                <Star size={10} className="text-[#FFB800] fill-[#FFB800]" />
                4.7
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT SIDE (3 Vertical Cards) */}
        <div className="hidden lg:flex flex-col gap-4 lg:w-[22%] h-auto lg:h-full shrink-0">

          {/* Colors Card */}
          <div className="bg-[var(--white)] border border-[var(--border)] rounded-[2rem] px-6 py-5 shadow-sm shrink-0">
            <h3 className="text-[var(--text-primary)] font-medium mb-3 text-[13px]">Popular Colors</h3>
            <div className="flex justify-between items-center w-full">
              <div className="w-8 h-8 rounded-full bg-blue-600 border-[3px] border-[var(--white)] shadow-md cursor-pointer hover:scale-110 transition-transform" />
              <div className="w-8 h-8 rounded-full bg-orange-500 border-[3px] border-[var(--white)] shadow-md cursor-pointer hover:scale-110 transition-transform" />
              <div className="w-8 h-8 rounded-full bg-[#00C853] border-[3px] border-[var(--white)] shadow-md cursor-pointer hover:scale-110 transition-transform" />
              <div className="w-8 h-8 rounded-full bg-rose-500 border-[3px] border-[var(--white)] shadow-md cursor-pointer hover:scale-110 transition-transform" />
              <div className="w-8 h-8 rounded-full bg-[#00E5FF] border-[3px] border-[var(--white)] shadow-md cursor-pointer hover:scale-110 transition-transform" />
            </div>
          </div>

          {/* New Gen Earbuds Card */}
          <div className="bg-[var(--white)] border border-[var(--border)] rounded-[2rem] p-6 relative group cursor-pointer shadow-sm shrink-0 min-h-[220px] flex items-center overflow-hidden" onClick={() => navigate('/products')}>
            <div className="absolute inset-0 z-0">
              <img
                src={earbudProduct.image || "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?q=80&w=400&auto=format&fit=crop"}
                alt="Earbuds"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="relative z-10 h-full flex flex-col justify-between w-full pointer-events-none">
              <h3 className="text-[var(--text-primary)] font-medium text-[17px] leading-tight">New Gen <br />X-Bud</h3>
              <div className="bg-[var(--white)] border border-[var(--border)] w-9 h-9 flex items-center justify-center rounded-full shadow-sm text-[var(--text-primary)] group-hover:bg-[var(--cta)] group-hover:text-white transition-colors pointer-events-auto">
                <ArrowUpRight size={14} />
              </div>
            </div>
          </div>

          {/* Tall Headphone Card */}
          <div className="bg-[var(--neutral-bg)] border border-[var(--border)] rounded-[2rem] p-6 flex-1 flex flex-col relative group cursor-pointer overflow-hidden shadow-sm min-h-[300px]" onClick={() => navigate('/products')}>
            <div className="absolute top-6 right-6 bg-[var(--white)] border border-[var(--border)] w-9 h-9 flex items-center justify-center rounded-full z-20 group-hover:bg-[var(--cta)] group-hover:text-white transition-colors text-[var(--text-primary)] shadow-sm">
              <ArrowUpRight size={14} />
            </div>

            <div className="absolute inset-0 z-0">
              <img
                src={vrProduct.image || "https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?q=80&w=600&auto=format&fit=crop"}
                alt="Headphone"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
            </div>

            <div className="relative z-10 mt-auto pb-2">
              <h3 className="text-[var(--text-primary)] font-medium text-lg mb-1 leading-tight max-w-[180px]">{vrProduct.name || "Light Grey Surface Headphone"}</h3>
              <p className="text-[var(--text-secondary)] text-[11px]">Boosted with bass</p>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
