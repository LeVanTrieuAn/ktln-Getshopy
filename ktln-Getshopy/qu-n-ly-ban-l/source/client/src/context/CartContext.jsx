import { createContext, useContext, useState, useEffect } from 'react';
import { message } from 'antd';

message.config({
  maxCount: 1,
  duration: 2.2,
});

const CartContext = createContext();

import { useApp } from './AppContext';

export function CartProvider({ children }) {
  const { b2cUser, user, openAuthModal } = useApp();
  const [cartOpen, setCartOpen] = useState(false);

  const [cart, setCart] = useState([]);

  // Load cart when user changes
  useEffect(() => {
    const userId = b2cUser?.id || user?.id || 'guest';
    const saved = localStorage.getItem(`b2c_cart_${userId}`);
    
    // Migrate old generic cart if applicable and we are logged in, but to avoid 
    // overriding, let's just stick to the new key structure.
    if (!saved) {
      setCart([]);
      return;
    }
    
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) { setCart([]); return; }
      
      setCart(parsed
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
        })
      );
    } catch {
      setCart([]);
    }
  }, [b2cUser, user]);

  // Save cart when it changes
  useEffect(() => {
    const userId = b2cUser?.id || user?.id || 'guest';
    try {
      localStorage.setItem(`b2c_cart_${userId}`, JSON.stringify(cart));
    } catch (e) {
      console.error('Failed to save cart to localStorage', e);
    }
  }, [cart, b2cUser, user]);

  const openCart = () => setCartOpen(true);
  const closeCart = () => setCartOpen(false);

  const addToCart = (product, quantity = 1, shouldOpenDrawer = false, buyNowMode = false) => {
    if (!b2cUser && !user) {
      message.warning('Vui lòng đăng nhập để thêm vào giỏ hàng');
      if (typeof openAuthModal === 'function') openAuthModal();
      return;
    }

    if (!product || product.id == null) {
      console.warn('addToCart called without valid product id:', product);
      return;
    }

    const numQty = Math.max(1, typeof quantity === 'number' && !isNaN(quantity) ? quantity : 1);
    const rawPrice = Number(product.price ?? product.selectedVariant?.price ?? 0);
    const safePrice = isNaN(rawPrice) || rawPrice < 0 ? 0 : rawPrice;

    const targetVarId = product.selectedVariant?.id || null;
    const existingItem = cart.find(item => 
      String(item.id) === String(product.id) && 
      (item.selectedVariant?.id || null) === targetVarId
    );
    const currentQty = existingItem?.quantity || 0;
    const maxStock = product.selectedVariant?.stock ?? product.stock ?? 999;

    let finalAddedQty = numQty;
    if (currentQty + numQty > maxStock) {
      finalAddedQty = maxStock - currentQty;
    }

    if (finalAddedQty <= 0) {
      message.warning(`Bạn đã thêm tối đa số lượng tồn kho (${maxStock}) của sản phẩm này!`);
      if (shouldOpenDrawer) setCartOpen(true);
      return;
    }

    setCart(prev => {
      const existingIndex = prev.findIndex(item => 
        String(item.id) === String(product.id) && 
        (item.selectedVariant?.id || null) === targetVarId
      );
      
      let newCart = [...prev];
      if (existingIndex >= 0) {
        const existing = newCart[existingIndex];
        newCart[existingIndex] = {
          ...existing,
          ...product,
          price: safePrice || existing.price || 0,
          quantity: (existing.quantity || 0) + finalAddedQty,
          selected: true
        };
      } else {
        newCart.push({
          ...product,
          price: safePrice,
          quantity: finalAddedQty,
          selected: true
        });
      }

      if (buyNowMode) {
        newCart = newCart.map((item, idx) => {
          if (existingIndex >= 0 ? idx === existingIndex : idx === newCart.length - 1) {
            return { ...item, selected: true };
          }
          return { ...item, selected: false };
        });
      }

      return newCart;
    });

    const prodTitle = product.name ? ` "${product.name}"` : '';
    message.destroy();
    if (currentQty + numQty > maxStock) {
      message.warning(`Chỉ có thể thêm ${finalAddedQty} sản phẩm (đã đạt giới hạn tồn kho).`);
    } else {
      message.success(`Đã thêm${prodTitle} vào giỏ hàng`);
    }

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
      if (match) {
        const maxStock = item.selectedVariant?.stock ?? item.stock ?? 999;
        if (numQty > maxStock) {
          message.warning(`Tồn kho chỉ còn ${maxStock} sản phẩm`);
          return { ...item, quantity: maxStock };
        }
        return { ...item, quantity: numQty };
      }
      return item;
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

