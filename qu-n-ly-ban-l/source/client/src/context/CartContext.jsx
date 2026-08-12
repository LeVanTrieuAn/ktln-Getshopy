import { createContext, useContext, useState, useEffect } from 'react';
import { message } from 'antd';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('b2c_cart');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return parsed.map(item => ({
        ...item,
        quantity: typeof item.quantity === 'number' && !isNaN(item.quantity) ? item.quantity : 1
      }));
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('b2c_cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product, quantity = 1) => {
    setCart(prev => {
      // Find existing item with SAME product id AND SAME variant id
      const existingIndex = prev.findIndex(item => 
        item.id === product.id && item.selectedVariant?.id === product.selectedVariant?.id
      );
      
      if (existingIndex >= 0) {
        const newCart = [...prev];
        newCart[existingIndex].quantity += quantity;
        return newCart;
      }
      return [...prev, { ...product, quantity, selected: true }];
    });
    message.success('Đã thêm vào giỏ hàng');
  };

  const updateQuantity = (id, variantId, quantity) => {
    if (quantity < 1) return removeFromCart(id, variantId);
    setCart(prev => prev.map(item => 
      (item.id === id && item.selectedVariant?.id === variantId) ? { ...item, quantity } : item
    ));
  };

  const removeFromCart = (id, variantId) => {
    setCart(prev => prev.filter(item => !(item.id === id && item.selectedVariant?.id === variantId)));
  };

  const toggleSelect = (id, variantId) => {
    setCart(prev => prev.map(item => 
      (item.id === id && item.selectedVariant?.id === variantId) ? { ...item, selected: !item.selected } : item
    ));
  };

  const toggleSelectAll = (checked) => {
    setCart(prev => prev.map(item => ({ ...item, selected: checked })));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Only calculate total for SELECTED items
  const cartTotal = cart.filter(item => item.selected).reduce((total, item) => total + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider value={{ 
      cart, addToCart, updateQuantity, removeFromCart, clearCart, 
      cartTotal, cartCount, toggleSelect, toggleSelectAll 
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
