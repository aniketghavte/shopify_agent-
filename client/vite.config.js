import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
// https://vitejs.dev/config/
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, ".", "");
    var apiTarget = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8000";
    return {
        plugins: [react()],
        server: {
            port: 5173,
            host: true,
            proxy: {
                "/api": {
                    target: apiTarget,
                    changeOrigin: true,
                    rewrite: function (p) { return p.replace(/^\/api/, ""); },
                },
            },
        },
        build: {
            outDir: "dist",
            sourcemap: true,
            target: "es2022",
        },
    };
});
