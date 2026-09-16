package ai.sinergy.messenger;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

public class SynergyP2PService extends Service {
  public static final long MAX_SESSION_MS = 5L * 60L * 60L * 1000L;
  private static final String CHANNEL_ID = "synergy_p2p_online";
  private static final int NOTIFICATION_ID = 7301;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private final Runnable timeout = this::stopSelf;

  @Override public void onCreate() {
    super.onCreate();
    NotificationManager manager = getSystemService(NotificationManager.class);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) manager.createNotificationChannel(new NotificationChannel(CHANNEL_ID, "SYNERGY P2P online window", NotificationManager.IMPORTANCE_LOW));
  }

  @Override public int onStartCommand(Intent intent, int flags, int startId) {
    Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.stat_notify_sync_noanim)
      .setContentTitle("SYNERGY Messenger")
      .setContentText("P2P online window is active")
      .setOngoing(true).setSilent(true).build();
    int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC : 0;
    ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type);
    handler.removeCallbacks(timeout); handler.postDelayed(timeout, MAX_SESSION_MS);
    return START_NOT_STICKY;
  }

  @Override public void onDestroy() { handler.removeCallbacks(timeout); super.onDestroy(); }
  @Override public IBinder onBind(Intent intent) { return null; }
}
