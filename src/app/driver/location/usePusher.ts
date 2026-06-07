import Pusher from "pusher-js";
import { useState, useEffect } from "react";
import type { Channel } from "pusher-js";
const usePusher = (appKey: string, appCluster: string) => {
  const [pusherInstance, setPusherInstance] = useState<Pusher | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<unknown>(null);
  useEffect(() => {
    if (appKey && appCluster) {
      let pusherObj: Pusher | undefined;
      try {
        pusherObj = new Pusher(appKey, {
          cluster: appCluster,
        });
        setPusherInstance(pusherObj);
      } catch (err) {
        setError(`Error occurred, pusherObj: ${String(err)}`);
      }
      return () => {
        if (pusherObj) {
          pusherObj.disconnect();
          setPusherInstance(null);
          setIsConnected(false);
        }
      };
    }
  }, [appKey, appCluster]);
  console.log("jhgfdcvkjfdfgh", channel);
  const startSocket = (channelName: string, eventName: string) => {
    if (pusherInstance && channelName && eventName) {
      try {
        const newChannel = pusherInstance.subscribe(channelName);
        setChannel(newChannel);
        newChannel.bind(eventName, (data: unknown) => {
          console.log(`Received data from ${eventName}:`, data);
          setMessage(data);
        });
        setIsConnected(true);
      } catch (err) {
        setError(`Error occurred, startSocket: ${String(err)}`);
      }
    } else {
      setError("Pusher instance, channel name, or event name not provided.");
    }
  };
  const closeSocket = () => {
    if (pusherInstance) {
      pusherInstance.disconnect();
      setPusherInstance(null);
      setIsConnected(false);
    }
    if (channel && pusherInstance) {
      console.log(channel);
      channel.unbind_all();
      pusherInstance.unsubscribe(channel.name);
      setChannel(null);
      setIsConnected(false);
    }
  };
  return {
    isConnected,
    error,
    startSocket,
    closeSocket,
    message,
  };
};
export default usePusher;
