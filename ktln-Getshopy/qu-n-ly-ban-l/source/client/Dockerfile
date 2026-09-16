# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ARG VITE_WS_URL
# Vite nhúng biến VITE_* vào bundle LÚC BUILD, không đọc lúc chạy. Thiếu ARG
# này thì dù .env có Client ID, bản build vẫn ra chuỗi rỗng — và triệu chứng
# là nút Google biến mất mà không có lỗi nào.
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
