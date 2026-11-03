import * as React from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/context/CartContext";

const CATEGORY_ICONS: Record<string, string> = {
  watches: "bi-smartwatch",
  airpods: "bi-earbuds",
  headphones: "bi-headphones",
  smartphones: "bi-phone",
};

export interface ProductCardProps extends React.HTMLAttributes<HTMLDivElement> {
  product?: any;
  imageUrl?: string;
  name?: string;
  tagline?: string;
  price?: number;
  currency?: string;
  isCouponPrice?: boolean;
  originalPrice?: number;
  offerText?: string;
  onAddToCart?: (e: React.MouseEvent, product: any) => void;
}

const ProductCard = React.forwardRef<HTMLDivElement, ProductCardProps>(
  (
    {
      className,
      product: rawProduct,
      imageUrl,
      name: propName,
      tagline,
      price: propPrice,
      currency = "₹",
      isCouponPrice,
      originalPrice: propOriginalPrice,
      offerText,
      onClick,
      ...props
    },
    ref
  ) => {
    const navigate = useNavigate();
    const { addToCart } = useCart() || {};
    const [added, setAdded] = useState(false);

    const raw = rawProduct || {};
    const id = raw.id;
    const name = propName || raw.name || "Product";
    const brand = raw.brand || null;
    const category = raw.category || null;
    const description = raw.description || tagline || (category ? `${category} Collection` : "Genuine Key & Remote");
    const image = imageUrl || raw.image_url || raw.image || "";
    const price = propPrice ?? raw.price ?? 0;
    const originalPrice = propOriginalPrice ?? raw.original_price ?? raw.originalPrice ?? price;
    const rating = (raw.rating !== undefined && raw.rating !== null && Number(raw.rating) > 0) ? Number(raw.rating) : 0;
    const reviewCount = raw.review_count ?? raw.reviewCount ?? raw.reviews ?? 0;
    const hasRating = rating > 0 || reviewCount > 0;
    const badge = raw.badge || (offerText && !offerText.includes("%") ? offerText : null);
    const inStock = raw.in_stock ?? raw.inStock ?? true;

    const discount = originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;

    const savings = originalPrice > price ? originalPrice - price : 0;

    const formatPrice = (amount: number) => {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 0,
      })
        .format(amount)
        .replace("₹", `${currency}`);
    };

    const handleAddToCart = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!inStock) return;
      if (addToCart) {
        addToCart({
          id,
          sku: (raw as any)?.sku || `SMN-${((raw as any)?.category || 'GEN').substring(0, 3).toUpperCase()}-${String(id).padStart(4, '0')}`,
          name,
          price,
          originalPrice,
          image,
          image_url: image,
          inStock,
          ...raw,
        });
      }
      setAdded(true);
      setTimeout(() => setAdded(false), 1600);
    };

    const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (onClick) {
        onClick(e);
      } else if (id) {
        navigate(`/products/${id}`);
      }
    };

    return (
      <motion.div
        ref={ref}
        className={cn(
          "glass-card group relative flex h-full w-full flex-col items-center justify-between p-2.5 sm:p-5 text-center text-[#1C1814] cursor-pointer select-none",
          className
        )}
        whileHover={{ y: -6 }}
        transition={{ type: "spring", stiffness: 320, damping: 20 }}
        onClick={handleCardClick}
        {...props}
      >
        {/* Product Image Box with Pure White Background */}
        <div 
          className="relative mb-2 flex h-36 sm:h-48 w-full items-center justify-center overflow-hidden rounded-xl bg-white border border-neutral-200/60 p-2 sm:p-3 shrink-0"
          style={{ backgroundColor: '#FFFFFF' }}
        >
          <img
            src={image}
            alt={name}
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />

          {/* Top-Left Badge (e.g. Best Seller / Top Rated) */}
          {badge && (
            <span className="absolute top-1.5 left-1.5 rounded-full bg-[#E5B824] px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-white shadow-md z-10">
              {badge}
            </span>
          )}

          {/* Top-Right Discount Tag (-29%) */}
          {discount > 0 && (
            <span className="absolute top-1.5 right-1.5 rounded-md bg-[#059669] px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-white shadow-md z-10">
              -{discount}%
            </span>
          )}

          {/* Out of Stock Overlay */}
          {!inStock && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-white font-bold text-xs uppercase tracking-wider z-10">
              <i className="bi bi-x-circle mr-1.5" /> Out of Stock
            </div>
          )}
        </div>

        {/* Card Body Content */}
        <div className="flex flex-col flex-1 w-full justify-between items-start text-left">
          {/* Brand & Category Row */}
          {(brand || category) && (
            <div className="flex items-center justify-between w-full mb-1 gap-1 min-w-0 h-4 shrink-0">
              {brand ? (
                <span
                  className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-[#2471E5] truncate max-w-[55%]"
                  style={{ color: 'rgb(36, 113, 229)' }}
                >
                  <i className="bi bi-building shrink-0" /> <span className="truncate">{brand}</span>
                </span>
              ) : <span />}
              {category && (
                <span className="flex items-center gap-1 rounded-full bg-neutral-100/90 border border-neutral-200/80 px-1.5 sm:px-2.5 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#5E5549] shrink-0">
                  <i className={`bi ${CATEGORY_ICONS[category.toLowerCase()] || "bi-box"}`} /> {category}
                </span>
              )}
            </div>
          )}

          {/* Product Title */}
          <h3 className="font-bold text-xs sm:text-base text-[#1C1814] tracking-wide text-left w-full line-clamp-1 transition-colors duration-200 group-hover:text-[#B88424] mb-1 shrink-0 h-4 sm:h-5">
            {name}
          </h3>

          {/* Rating Stars & Count */}
          <div className="flex items-center justify-start gap-1 w-full text-left mb-1 shrink-0 h-4 min-h-[16px]">
            {hasRating ? (
              <>
                <span className="flex items-center gap-0.5 text-[#F9D949] text-[11px] sm:text-xs">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <i
                      key={i}
                      className={`bi ${
                        i <= Math.floor(rating)
                          ? "bi-star-fill"
                          : i - rating < 1
                          ? "bi-star-half"
                          : "bi-star text-neutral-300"
                      }`}
                    />
                  ))}
                </span>
                {rating > 0 && <span className="text-[11px] sm:text-xs font-bold text-[#1C1814]">{rating.toFixed(1)}</span>}
                {reviewCount > 0 && <span className="text-[10px] sm:text-xs text-[#6B7280]">({reviewCount.toLocaleString()})</span>}
              </>
            ) : (
              <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                <i className="bi bi-patch-check-fill text-[#E5B824]" /> Genuine
              </span>
            )}
          </div>

          {/* Product Description (shown in place of rate) */}
          <p className="text-[10px] sm:text-xs text-[#5E5549] line-clamp-1 text-left w-full font-normal leading-tight mb-2 shrink-0 h-4">
            {description}
          </p>

          {/* Pricing Row: Left-aligned price, Save value on big screens only */}
          <div className="flex items-center justify-between w-full pt-0.5 mb-2 shrink-0 min-h-[22px]">
            <div className="flex items-baseline justify-start gap-1 shrink-0">
              <span className="text-sm sm:text-xl lg:text-2xl font-black tracking-tight text-[#1C1814]">
                {formatPrice(price)}
              </span>
              {originalPrice > price && (
                <span className="text-[10px] sm:text-xs text-[#9E9180] line-through">
                  {formatPrice(originalPrice)}
                </span>
              )}
            </div>
            {savings > 0 && (
              <span className="hidden md:inline text-xs font-bold text-[#059669] whitespace-nowrap shrink-0 text-right">
                Save {formatPrice(savings)}
              </span>
            )}
          </div>

          {/* Action Button: Add to Cart */}
          <button
            id={id ? `cart-btn-${id}` : undefined}
            className={cn(
              "w-full flex items-center justify-center gap-1.5 py-2 sm:py-2.5 px-2.5 sm:px-4 rounded-xl font-bold text-xs sm:text-sm tracking-wide transition-all duration-300 shadow-md",
              added
                ? "bg-[#059669] text-white border border-[#059669]"
                : "bg-[#E5B824] hover:bg-[#F9D949] text-white hover:text-black border border-white/25 hover:shadow-[0_0_20px_rgba(249,217,73,0.5)]"
            )}
            onClick={handleAddToCart}
            disabled={!inStock}
          >
            {!inStock ? (
              <>
                <i className="bi bi-x-circle" /> Out of Stock
              </>
            ) : added ? (
              <>
                <i className="bi bi-check-circle-fill" /> Added!
              </>
            ) : (
              <>
                <i className="bi bi-cart-plus" /> Add to Cart
              </>
            )}
          </button>
        </div>
      </motion.div>
    );
  }
);

ProductCard.displayName = "ProductCard";

export { ProductCard };
