export const CSS = `
.cp-wrap{order:1;position:relative;display:inline-flex;align-items:center;flex:none}
.cp-root{position:relative;display:inline-flex;align-items:center;flex:none}
.cp-chip{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 8px;border-radius:7px;font-family:inherit;font-size:12px;line-height:1;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary);background:transparent;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.3));cursor:pointer;user-select:none;white-space:nowrap;transition:color .12s,border-color .12s,background .12s}
.cp-chip:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l3,rgba(128,128,128,.55))}
.cp-chip[data-open=true]{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary,#3469db)}
.cp-dot{width:5px;height:5px;border-radius:50%;flex:none;background:var(--dsw-alias-brand-primary,#3469db)}
.cp-chip[data-custom=false] .cp-dot{background:var(--dsw-alias-label-tertiary,#999)}
.cp-error-pop{position:absolute;bottom:calc(100% + 8px);right:0;z-index:60;width:max-content;max-width:min(92vw,320px);box-sizing:border-box;padding:6px 9px;border-radius:8px;font-size:11px;line-height:1.5;text-align:left;overflow-wrap:anywhere;color:var(--dsw-alias-state-error-primary,#d93025);background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.3));box-shadow:0 8px 24px rgba(0,0,0,.18)}
.cp-pop{position:absolute;bottom:calc(100% + 8px);right:0;z-index:60;width:344px;max-width:min(92vw,344px);box-sizing:border-box;display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:12px;font-size:12px;line-height:1.5;text-align:left;color:var(--dsw-alias-label-primary,#222);background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.3));box-shadow:0 10px 32px rgba(0,0,0,.22)}
.cp-pop-head{display:flex;flex-direction:column;gap:3px}
.cp-pop-route{font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:11px;opacity:.72;overflow-wrap:anywhere}
.cp-status{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;font-variant-numeric:tabular-nums}
.cp-status b{font-weight:600}
.cp-grid{display:flex;flex-wrap:wrap;gap:5px}
.cp-row{display:flex;gap:6px;align-items:center}
.cp-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.cp-fb-menu{position:absolute;bottom:calc(100% + 6px);right:0;z-index:1100;min-width:184px;max-width:min(92vw,300px);box-sizing:border-box;display:flex;flex-direction:column;padding:4px;border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-2,#fff);border:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.24));box-shadow:var(--dsw-elevation-prominent,0 12px 32px rgba(0,0,0,.24));color:var(--dsw-alias-label-primary)}
.cp-fb-item{display:block;width:100%;box-sizing:border-box;text-align:left;font:inherit;font-size:13px;color:inherit;background:transparent;border:0;border-radius:var(--dsw-radius-sm,6px);padding:6px 10px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-fb-item:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12))}
.cp-fb-item:disabled{opacity:.45;cursor:not-allowed}
.cp-fb-sep{height:1px;margin:4px 6px;background:var(--dsw-alias-border-l2,rgba(128,128,128,.24))}
.cp-fb-label{padding:5px 10px 3px;font-size:11px;color:var(--dsw-alias-label-tertiary,#888);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp-fb-mask{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.32))}
.cp-fb-dialog{width:min(600px,94vw);max-height:86vh;box-sizing:border-box;display:flex;flex-direction:column;gap:14px;padding:20px;border-radius:var(--dsw-radius-panel,14px);background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-elevation-prominent,0 20px 60px rgba(0,0,0,.35))}
.cp-fb-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.cp-fb-head h2{margin:0;font-size:15px;font-weight:600}
.cp-fb-close{font:inherit;font-size:16px;line-height:1;color:inherit;background:transparent;border:0;cursor:pointer;opacity:.6;padding:2px 6px}
.cp-fb-close:hover{opacity:1}
.cp-dialog{width:min(600px,94vw)}
.cp-panel{display:flex;flex-direction:column;gap:10px;min-width:0;font-size:12px;line-height:1.5}
.cp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap}
.cp-title{margin:0;font-size:13px;font-weight:600}
.cp-sub{font-size:11px;opacity:.62;overflow-wrap:anywhere}
.cp-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.cp-scroll{display:flex;flex-direction:column;gap:8px;max-height:min(58vh,460px);overflow:auto;padding-right:2px}
.cp-provider{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.24));border-radius:10px;padding:8px 10px;display:flex;flex-direction:column;gap:6px}
.cp-provider-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.cp-provider-name{font-weight:600;font-size:12px;font-family:var(--dsw-font-mono,ui-monospace,monospace);overflow-wrap:anywhere}
.cp-spacer{flex:1}
.cp-model{display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:7px;background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.07));flex-wrap:wrap}
.cp-model-id{font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:11px;overflow-wrap:anywhere;flex:1 1 150px;min-width:0}
.cp-model-value{font-size:11px;font-variant-numeric:tabular-nums;white-space:nowrap;opacity:.78}
.cp-badge{font-size:10px;padding:1px 5px;border-radius:4px;background:var(--dsw-alias-brand-primary,#3469db);color:var(--dsw-alias-label-primary-foreground,#fff)}
.cp-badge-soft{font-size:10px;padding:1px 5px;border-radius:4px;background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.16));color:inherit;opacity:.75}
.cp-input{font:inherit;font-size:11px;font-variant-numeric:tabular-nums;color:inherit;background:transparent;box-sizing:border-box;min-width:0;width:96px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.34));border-radius:6px;padding:3px 6px}
.cp-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary,#3469db)}
.cp-input-grow{flex:1 1 120px;width:auto}
.cp-btn{font:inherit;font-size:11px;color:inherit;background:transparent;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.34));border-radius:6px;padding:3px 8px;cursor:pointer;white-space:nowrap;transition:background .1s,border-color .1s}
.cp-btn:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary,#3469db)}
.cp-btn:disabled{opacity:.45;cursor:not-allowed}
.cp-btn-primary{background:var(--dsw-alias-brand-primary,#3469db);border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff)}
.cp-btn-primary:hover:not(:disabled){opacity:.9}
.cp-foot{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding-top:2px}
.cp-error{color:var(--dsw-alias-state-error-primary,#d93025);font-size:11px;overflow-wrap:anywhere}
.cp-notice{color:var(--dsw-alias-state-success-primary,#1a7f37);font-size:11px;overflow-wrap:anywhere}
.cp-hint{font-size:11px;opacity:.6;overflow-wrap:anywhere}
.cp-empty{font-size:11px;opacity:.6;padding:6px 2px}
`;
