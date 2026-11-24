import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './stores/assets/main.css'
import './workspace.css'
createApp(App).use(createPinia()).use(router).mount('#app')
