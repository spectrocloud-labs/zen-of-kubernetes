# Build the react code
FROM node:14 as build-stage

WORKDIR /app

COPY heartrate-ui/package*.json /app/
COPY heartrate-ui/.npmrc /app/

RUN npm i
COPY ./heartrate-ui /app/

RUN npm run build

# Copy build content to nginx root
FROM nginx:1.23.1-alpine

COPY --from=build-stage /app/dist/ /usr/share/nginx/html
COPY --from=build-stage /app/config/nginx.conf /etc/nginx/
