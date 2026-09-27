using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Threading;

public static class AzCtl {
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool f);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint f);
  [DllImport("user32.dll")] static extern uint SendInput(uint n, INPUT[] i, int size);
  [DllImport("user32.dll")] static extern uint MapVirtualKey(uint c, uint t);
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte sc, uint f, UIntPtr e);

  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort vk, sc; public uint flags, time; public IntPtr extra; }
  [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx, dy; public uint data, flags, time; public IntPtr extra; }
  [StructLayout(LayoutKind.Explicit)] struct UNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public UNION u; }

  public static IntPtr Window() {
    foreach (var p in Process.GetProcessesByName("azahar"))
      if (p.MainWindowHandle != IntPtr.Zero) return p.MainWindowHandle;
    return IntPtr.Zero;
  }

  public static bool Focus() {
    var h = Window(); if (h == IntPtr.Zero) return false;
    if (GetForegroundWindow() == h) return true;
    // Alt tap lets a background process take the foreground.
    keybd_event(0x12, 0, 0, UIntPtr.Zero); keybd_event(0x12, 0, 2, UIntPtr.Zero);
    uint fg = GetWindowThreadProcessId(GetForegroundWindow(), IntPtr.Zero), me = GetCurrentThreadId();
    AttachThreadInput(me, fg, true);
    ShowWindow(h, 9); SetForegroundWindow(h);
    AttachThreadInput(me, fg, false);
    Thread.Sleep(80);
    return GetForegroundWindow() == h;
  }

  static void Send(ushort vk, bool up, bool ext) {
    var i = new INPUT { type = 1 };
    i.u.ki.vk = vk; i.u.ki.sc = (ushort)MapVirtualKey(vk, 0);
    i.u.ki.flags = (uint)(0x8 | (up ? 0x2 : 0) | (ext ? 0x1 : 0)); // SCANCODE
    SendInput(1, new[] { i }, Marshal.SizeOf(typeof(INPUT)));
  }

  // chord: VKs held together for holdMs, then released.
  public static void Press(ushort[] vks, int holdMs) {
    foreach (var v in vks) Send(v, false, IsExt(v));
    Thread.Sleep(holdMs);
    for (int k = vks.Length - 1; k >= 0; k--) Send(vks[k], true, IsExt(vks[k]));
  }
  static bool IsExt(ushort v) { return v >= 0x21 && v <= 0x2E; }

  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] static extern void mouse_event(uint f, int dx, int dy, uint d, UIntPtr e);

  // Touch: a left click at client coordinates (the same frame as Shot's PNG) on the bottom screen.
  public static void Tap(int x, int y, int holdMs) {
    var h = Window();
    var p = new POINT { X = x, Y = y }; ClientToScreen(h, ref p);
    SetCursorPos(p.X, p.Y); Thread.Sleep(30);
    mouse_event(0x2, 0, 0, 0, UIntPtr.Zero); Thread.Sleep(holdMs);
    mouse_event(0x4, 0, 0, 0, UIntPtr.Zero);
  }

  public static string Shot(string path) {
    var h = Window(); if (h == IntPtr.Zero) return "no window";
    RECT r; GetClientRect(h, out r);
    var p = new POINT(); ClientToScreen(h, ref p);
    int w = r.R - r.L, ht = r.B - r.T;
    using (var bmp = new Bitmap(w, ht)) {
      using (var g = Graphics.FromImage(bmp)) g.CopyFromScreen(p.X, p.Y, 0, 0, new Size(w, ht));
      bmp.Save(path, ImageFormat.Png);
    }
    return w + "x" + ht + " @" + p.X + "," + p.Y;
  }
}
