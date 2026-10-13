// Shared data is authorized on the server. Local preferences stay on the device.
import {clubStorage} from './clubApi.js';
if(typeof window!=='undefined'&&!window.storage)window.storage=clubStorage;
