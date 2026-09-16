import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Tag } from 'antd';
import { ShopOutlined, HomeOutlined, CarOutlined } from '@ant-design/icons';
import ReactDOMServer from 'react-dom/server';

// Create custom icons using Ant Design icons rendered to HTML
const createCustomIcon = (iconNode, color) => {
  const htmlString = ReactDOMServer.renderToString(
    <div style={{
      background: '#fff',
      border: `2px solid ${color}`,
      borderRadius: '50%',
      width: '32px',
      height: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: color,
      fontSize: '18px',
      boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
    }}>
      {iconNode}
    </div>
  );

  return L.divIcon({
    html: htmlString,
    className: 'custom-leaflet-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const shopIcon = createCustomIcon(<ShopOutlined />, '#10b981');
const homeIcon = createCustomIcon(<HomeOutlined />, '#3b82f6');
const shipperIcon = createCustomIcon(<CarOutlined />, '#f59e0b');

// Helper component to fit map to bounds
const MapBounds = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length === 2) {
      map.fitBounds(bounds, { padding: [50, 50] });
      // Invalidate size in case modal opened and map was hidden
      setTimeout(() => map.invalidateSize(), 100);
      setTimeout(() => map.invalidateSize(), 400);
    }
  }, [map, bounds]);
  return null;
};

export default function OrderTrackingMap({ order }) {
  const [shipperPos, setShipperPos] = useState(null);

  // Generate pseudo-random coordinates based on order ID to keep it consistent
  // Default base coordinates (Ho Chi Minh City center)
  const baseLat = 10.7769;
  const baseLng = 106.7009;
  
  // Extract numbers from order ID to use as offset
  const hash = order.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  // Store coordinate (Sender)
  const shopPos = [baseLat + (hash % 50) * 0.0001, baseLng + (hash % 30) * 0.0001];
  
  // Customer coordinate (Receiver) - spread out a bit
  const homePos = [baseLat + (hash % 100) * 0.001, baseLng + (hash % 80) * 0.001];

  const isShipping = order.status === 'SHIPPING';

  useEffect(() => {
    if (!isShipping) {
      if (order.status === 'DELIVERED' || order.status === 'COMPLETED') {
        setShipperPos(homePos);
      } else {
        setShipperPos(shopPos);
      }
      return;
    }

    // Animation for Shipper
    // Simple linear interpolation
    let progress = 0; 
    setShipperPos(shopPos);

    const interval = setInterval(() => {
      progress += 0.01; // 1% per tick
      if (progress > 1) progress = 1; // Cap at 100%

      const currentLat = shopPos[0] + (homePos[0] - shopPos[0]) * progress;
      const currentLng = shopPos[1] + (homePos[1] - shopPos[1]) * progress;
      
      setShipperPos([currentLat, currentLng]);

      // If reached, loop back for demonstration purposes
      if (progress >= 1) {
        progress = 0;
      }
    }, 100);

    return () => clearInterval(interval);
  }, [order.status]);

  const bounds = [shopPos, homePos];

  return (
    <div style={{ height: 400, width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid #eee' }}>
      <MapContainer bounds={bounds} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapBounds bounds={bounds} />
        
        {/* Route Line */}
        <Polyline positions={bounds} color="#10b981" weight={4} dashArray="5, 10" />

        {/* Shop Marker */}
        <Marker position={shopPos} icon={shopIcon}>
          <Popup>
            <strong>Cửa hàng GetShopy</strong><br />
            Nơi gửi hàng
          </Popup>
        </Marker>

        {/* Home Marker */}
        <Marker position={homePos} icon={homeIcon}>
          <Popup>
            <strong>{order.customer?.full_name || 'Khách hàng'}</strong><br />
            {order.customer?.address || 'Địa chỉ nhận hàng'}
          </Popup>
        </Marker>

        {/* Shipper Marker (Animated) */}
        {shipperPos && (
          <Marker position={shipperPos} icon={shipperIcon} zIndexOffset={1000}>
            <Popup>
              <strong>Shipper đang di chuyển</strong><br />
              {isShipping ? 'Dự kiến giao trong 30 phút' : 'Đang chờ xử lý'}
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
