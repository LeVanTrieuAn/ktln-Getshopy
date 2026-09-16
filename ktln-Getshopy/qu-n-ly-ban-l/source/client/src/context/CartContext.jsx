import { createContext, useContext, useState, useEffect } from 'react';
import { message } from 'antd';

message.config({
  maxCount: 1,
  duration: 2.2,
});

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cartOpen, setCartOpen] = useState(false);

  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('b2c_cart');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(item => item && item.id != null)
        .map(item => {
          const rawPrice = Number(item.price ?? item.selectedVariant?.price ?? 0);
          const safePrice = isNaN(rawPrice) || rawPrice < 0 ? 0 : rawPrice;
          const qty = typeof item.quantity === 'number' && !isNaN(item.quantity) && item.quantity > 0 ? item.quantity : 1;
          return {
            ...item,
            price: safePrice,
            quantity: qty,
            selected: item.selected !== false
          };
        });
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('b2c_cart', JSON.stringify(cart));
    } catch (e) {
      console.error('Failed to save cart to localStorage', e);
    }
  }, [cart]);

  const openCart = () => setCartOpen(true);
  const closeCart = () => setCartOpen(false);

  const addToCart = (product, quantity = 1, shouldOpenDrawer = false) => {
    if (!product || product.id == null) {
      console.warn('addToCart called without valid product id:', product);
      return;
    }

    const numQty = Math.max(1, typeof quantity === 'number' && !isNaN(quantity) ? quantity : 1);
    const rawPrice = Number(product.price ?? product.selectedVariant?.price ?? 0);
    const safePrice = isNaN(rawPrice) || rawPrice < 0 ? 0 : rawPrice;

    setCart(prev => {
      // Match by product ID and variant ID
      const targetVarId = product.selectedVariant?.id || null;
      const existingIndex = prev.findIndex(item => 
        String(item.id) === String(product.id) && 
        (item.selectedVariant?.id || null) === targetVarId
      );
      
      if (existingIndex >= 0) {
        const newCart = [...prev];
        const existingItem = newCart[existingIndex];
        const updatedQty = (existingItem.quantity || 0) + numQty;
        newCart[existingIndex] = {
          ...existingItem,
          ...product,
          price: safePrice || existingItem.price || 0,
          quantity: updatedQty,
          selected: true
        };
        return newCart;
      }

      return [...prev, {
        ...product,
        price: safePrice,
        quantity: numQty,
        selected: true
      }];
    });

    const prodTitle = product.name ? ` "${product.name}"` : '';
    message.destroy();
    message.success(`Đã thêm${prodTitle} vào giỏ hàng`);

    if (shouldOpenDrawer) {
      setCartOpen(true);
    }
  };

  const updateQuantity = (id, variantId, quantity) => {
    const numQty = Number(quantity);
    if (isNaN(numQty) || numQty < 1) {
      return removeFromCart(id, variantId);
    }
    setCart(prev => prev.map(item => {
      const match = String(item.id) === String(id) && (item.selectedVariant?.id || null) === (variantId || null);
      return match ? { ...item, quantity: numQty } : item;
    }));
  };

  const removeFromCart = (id, variantId) => {
    setCart(prev => prev.filter(item => 
      !(String(item.id) === String(id) && (item.selectedVariant?.id || null) === (variantId || null))
    ));
    message.info('Đã xóa sản phẩm khỏi giỏ hàng');
  };

  const toggleSelect = (id, variantId) => {
    setCart(prev => prev.map(item => {
      const match = String(item.id) === String(id) && (item.selectedVariant?.id || null) === (variantId || null);
      return match ? { ...item, selected: !item.selected } : item;
    }));
  };

  const toggleSelectAll = (checked) => {
    setCart(prev => prev.map(item => ({ ...item, selected: checked })));
  };

  const removeItemsFromCart = (itemsToRemove) => {
    if (!Array.isArray(itemsToRemove) || itemsToRemove.length === 0) return;
    const toRemoveSet = new Set(
      itemsToRemove.map(item => `${item.id}-${item.selectedVariant?.id || ''}`)
    );
    setCart(prev => prev.filter(item => 
      !toRemoveSet.has(`${item.id}-${item.selectedVariant?.id || ''}`)
    ));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Only calculate total for SELECTED items with valid prices
  const cartTotal = cart
    .filter(item => item.selected)
    .reduce((total, item) => {
      const p = Number(item.price) || 0;
      const q = Number(item.quantity) || 1;
      return total + (p * q);
    }, 0);

  const cartCount = cart.reduce((count, item) => count + (Number(item.quantity) || 0), 0);

  return (
    <CartContext.Provider value={{ 
      cart, setCart, addToCart, updateQuantity, removeFromCart, removeItemsFromCart, clearCart, 
      cartTotal, cartCount, toggleSelect, toggleSelectAll,
      cartOpen, setCartOpen, openCart, closeCart
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);

