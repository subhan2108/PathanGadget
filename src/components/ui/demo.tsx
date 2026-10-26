import { ProductCard, ProductCardProps } from "@/components/ui/product-card-2";
import { motion } from "framer-motion";

// Sample data for the product grid
const products: ProductCardProps[] = [
  {
    imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?q=80&w=800&auto=format&fit=crop", // Stock image
    name: "realme Buds Wireless 5 ANC",
    tagline: "Best ANC, Beast Battery Life",
    price: 1399,
    originalPrice: 2799,
    offerText: "1400 Off",
  },
  {
    imageUrl: "https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?q=80&w=800&auto=format&fit=crop", // Stock image
    name: "realme Buds Air7",
    tagline: "52dB Segment's Strongest ANC*",
    price: 2699,
    originalPrice: 4899,
    isCouponPrice: true,
    offerText: "Up to 100 Coupon",
  },
  {
    imageUrl: "https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?q=80&w=800&auto=format&fit=crop", // Stock image
    name: "realme Buds Air7 Pro",
    tagline: "The Sound Of Ai",
    price: 4499,
    originalPrice: 8999,
    offerText: "Up to 500 Bank Offer",
  },
  {
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=800&auto=format&fit=crop", // Stock image
    name: "realme Techlife Studio H1",
    tagline: "Style Your Sound",
    price: 3999,
    originalPrice: 7999,
    offerText: "Up to 500 Bank Offer",
  },
];

// Animation variants for the container and items
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1, // Delay between each child animation
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 10,
    },
  },
};

export default function ProductGridDemo() {
  return (
    <div className="w-full bg-background px-4 py-16">
      <div className="mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-bold tracking-tight" style={{ color: '#F5A623' }}>
            Let's Groove
          </h2>
        </div>

        {/* Responsive Product Grid with Staggered Animation */}
        <motion.div
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {products.map((product, index) => (
            <motion.div key={index} variants={itemVariants}>
              <ProductCard {...product} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
