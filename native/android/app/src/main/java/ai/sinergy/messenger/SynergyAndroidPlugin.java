package ai.sinergy.messenger;

import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SynergyAndroid")
public class SynergyAndroidPlugin extends Plugin {
  private JSObject describe(Intent intent) {
    JSObject out = new JSObject(); if (intent == null) return out;
    if (intent.getAction() != null) out.put("action", intent.getAction());
    Uri data = intent.getData(); if (data != null) out.put("url", data.toString());
    if (intent.getType() != null) out.put("mime", intent.getType());
    CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT); if (text != null) out.put("text", text.toString());
    JSArray uris = new JSArray(); ClipData clip = intent.getClipData();
    if (clip != null) for (int i = 0; i < clip.getItemCount(); i++) { Uri uri = clip.getItemAt(i).getUri(); if (uri != null) uris.put(uri.toString()); }
    out.put("uris", uris); return out;
  }

  private void startP2PService() { Context context = getContext(); ContextCompat.startForegroundService(context, new Intent(context, SynergyP2PService.class)); }
  private boolean stopP2PService() { return getContext().stopService(new Intent(getContext(), SynergyP2PService.class)); }

  @PluginMethod public void getLaunchIntent(PluginCall call) { call.resolve(describe(getActivity().getIntent())); }
  @PluginMethod public void startOnlineWindow(PluginCall call) {
    try { startP2PService(); JSObject out = new JSObject(); out.put("started", true); call.resolve(out); }
    catch (Exception e) { call.reject("ANDROID_ONLINE_WINDOW_START_FAILED", e); }
  }
  @PluginMethod public void stopOnlineWindow(PluginCall call) { JSObject out = new JSObject(); out.put("stopped", stopP2PService()); call.resolve(out); }

  @Override public void handleOnNewIntent(Intent intent) { super.handleOnNewIntent(intent); getActivity().setIntent(intent); notifyListeners("intentReceived", describe(intent)); }
}
