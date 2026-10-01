package com.offreader.reader;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayDeque;
import java.util.Deque;

/**
 * SAF-backed file access for linked books on Android. Scoped storage means a
 * "folder" is a persisted document-tree URI (content://...), not a path:
 * pickDirectory grants durable read permission via ACTION_OPEN_DOCUMENT_TREE,
 * listFiles walks the tree, and resolveToCache copies a book's bytes into app
 * cache so the WebView can stream them through convertFileSrc — content://
 * URIs can't feed it directly (read-through cache, per the storage roadmap).
 */
@CapacitorPlugin(name = "OffreaderFiles")
public class OffreaderFilesPlugin extends Plugin {

    private static final String[] CHILD_COLS = {
        DocumentsContract.Document.COLUMN_DOCUMENT_ID,
        DocumentsContract.Document.COLUMN_DISPLAY_NAME,
        DocumentsContract.Document.COLUMN_MIME_TYPE,
        DocumentsContract.Document.COLUMN_SIZE,
        DocumentsContract.Document.COLUMN_LAST_MODIFIED,
    };

    @PluginMethod
    public void pickDirectory(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
            | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "pickDirectoryResult");
    }

    @ActivityCallback
    private void pickDirectoryResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (data == null || data.getData() == null) {
            call.reject("No directory selected");
            return;
        }
        Uri treeUri = data.getData();
        try {
            getContext().getContentResolver().takePersistableUriPermission(
                treeUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (SecurityException ignored) {
            // Some providers don't persist — the URI still works this session.
        }
        JSObject ret = new JSObject();
        ret.put("treeUri", treeUri.toString());
        call.resolve(ret);
    }

    /** Single-document picker — used to relink a book whose file moved. */
    @PluginMethod
    public void pickDocument(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "pickDocumentResult");
    }

    @ActivityCallback
    private void pickDocumentResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (data == null || data.getData() == null) {
            call.reject("No document selected");
            return;
        }
        Uri docUri = data.getData();
        try {
            getContext().getContentResolver().takePersistableUriPermission(
                docUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (SecurityException ignored) { }
        JSObject ret = new JSObject();
        ret.put("uri", docUri.toString());
        call.resolve(ret);
    }

    @PluginMethod
    public void listFiles(PluginCall call) {
        String treeUriStr = call.getString("treeUri");
        if (treeUriStr == null) {
            call.reject("treeUri required");
            return;
        }
        try {
            Uri treeUri = Uri.parse(treeUriStr);
            JSArray files = new JSArray();
            // BFS over the document tree via buildChildDocumentsUriUsingTree —
            // no androidx.documentfile dependency.
            Deque<String> pending = new ArrayDeque<>();
            pending.push(DocumentsContract.getTreeDocumentId(treeUri));
            while (!pending.isEmpty()) {
                String dirDocId = pending.pop();
                Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, dirDocId);
                try (Cursor c = getContext().getContentResolver()
                        .query(childrenUri, CHILD_COLS, null, null, null)) {
                    if (c == null) continue;
                    while (c.moveToNext()) {
                        String docId = c.getString(0);
                        String mime = c.getString(2);
                        if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) {
                            pending.push(docId);
                        } else {
                            JSObject f = new JSObject();
                            f.put("uri", DocumentsContract
                                .buildDocumentUriUsingTree(treeUri, docId).toString());
                            f.put("name", c.getString(1));
                            f.put("size", c.getLong(3));
                            f.put("mtimeMs", c.getLong(4));
                            files.put(f);
                        }
                    }
                }
            }
            JSObject ret = new JSObject();
            ret.put("files", files);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to list files: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void fileExists(PluginCall call) {
        String uriStr = call.getString("uri");
        boolean exists = false;
        try {
            try (Cursor c = getContext().getContentResolver().query(
                    Uri.parse(uriStr),
                    new String[]{ DocumentsContract.Document.COLUMN_DOCUMENT_ID },
                    null, null, null)) {
                exists = c != null && c.moveToFirst();
            }
        } catch (Exception ignored) { }
        JSObject ret = new JSObject();
        ret.put("exists", exists);
        call.resolve(ret);
    }

    @PluginMethod
    public void statFile(PluginCall call) {
        String uriStr = call.getString("uri");
        JSObject ret = statInternal(uriStr);
        call.resolve(ret); // null fields mean "missing/unreadable"
    }

    private JSObject statInternal(String uriStr) {
        try (Cursor c = getContext().getContentResolver().query(
                Uri.parse(uriStr),
                new String[]{
                    DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                    DocumentsContract.Document.COLUMN_SIZE,
                    DocumentsContract.Document.COLUMN_LAST_MODIFIED},
                null, null, null)) {
            if (c == null || !c.moveToFirst()) return null;
            JSObject ret = new JSObject();
            ret.put("name", c.getString(0));
            ret.put("size", c.getLong(1));
            ret.put("mtimeMs", c.getLong(2));
            return ret;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Copies the document's bytes into app cache (keyed by the URI) and
     * returns the cache path. Skips the copy when a cached file already
     * matches the source size — the common re-open case.
     */
    @PluginMethod
    public void resolveToCache(PluginCall call) {
        String uriStr = call.getString("uri");
        if (uriStr == null) {
            call.reject("uri required");
            return;
        }
        try {
            Uri uri = Uri.parse(uriStr);
            JSObject stat = statInternal(uriStr);
            long srcSize = stat != null ? stat.getLong("size") : -1;
            String name = stat != null ? stat.getString("name") : null;
            String ext = (name != null && name.contains("."))
                ? name.substring(name.lastIndexOf('.'))
                : "";

            File cached = new File(getContext().getCacheDir(),
                "linked-" + Integer.toHexString(uriStr.hashCode()) + ext);
            if (!cached.exists() || (srcSize >= 0 && cached.length() != srcSize)) {
                try (InputStream in = getContext().getContentResolver().openInputStream(uri);
                     FileOutputStream out = new FileOutputStream(cached)) {
                    if (in == null) {
                        call.reject("Cannot open document");
                        return;
                    }
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) >= 0) out.write(buf, 0, n);
                }
            }

            JSObject ret = new JSObject();
            ret.put("path", cached.getAbsolutePath());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to resolve file: " + e.getMessage(), e);
        }
    }
}
