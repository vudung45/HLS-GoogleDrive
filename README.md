# Live Streaming Service
- The goal of this project is to utilize the underlying infrastructure of Google Drive to host our own live streaming service.
- Why Google Drive?
    + With the right recipe, we can literally scale to unlimited storage
    + Google's underlying CDN is kinda OP already. Streaming performance should be decent.


# TODOS:
- Upload -> Process:
    + ~Allow user to upload raw video to our service. The video will then be broken down into chunks, and distributed across multiple google drive accounts~
- Streaming:
    + ~Dynamically generate m3u8 file for processed videos~
    + Ensure that the link to the chunk is alive. Two possible solutions are: Passive Health Monitoring (Heartbeat), or just lazily checks on demand. The most optimal approach still needs to be verified. Ideally, lazy checks should yield the best consistency, however, the latency might be too much for live streaming.
- Possible LIVE STREAMING feature ( Like Twitch Live, Facebook Live, Youtube Live)


# Notes:
- https://github.com/googleapis/google-api-nodejs-client (Nodejs package)
- https://cloud.google.com/iam/docs/service-accounts:
    + Each google account can create ~100 service accounts. Each service account is basically a google account.
        * Pros:  
            + No manual login required, private secret is generated once and can be used forever
            + 15gb of free storage per service account ( 15 * 100 = 1.5TB / google account )
        * Cons:
            + No offical support to access the account through google drive UI (not really a con but something to keep in mind)
            + Reliability ???
- `ffmpeg -i test_upload.mp4 -acodec copy -vcodec copy -f hls -hls_time 20 -hls_list_size 0  output.m3u8`
- `http://127.0.0.1:3000/watch?uploadId=5e6f50257714840985965d52` -- video player
- `http://127.0.0.1:3000/uploadInfo/5e6f50257714840985965d52` -- UploadInfo Page

# Upload/File management
![architecture](https://i.imgur.com/TJraFtH.jpg)
