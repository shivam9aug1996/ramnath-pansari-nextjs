import Pusher from "pusher-js";
import { useState, useEffect } from "react";

const usePusher = (appKey, appCluster) => {
  const [pusherInstance, setPusherInstance] = useState(null);
  const [channel, setChannel] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (appKey && appCluster) {
      let pusherObj: any;
      try {
        pusherObj = new Pusher(appKey, {
          cluster: appCluster,
        });
        setPusherInstance(pusherObj);
      } catch (error) {
        setError("Error occurred, pusherObj", error);
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

  const startSocket = (channelName, eventName) => {
    if (pusherInstance && channelName && eventName) {
      try {
        const newChannel = pusherInstance.subscribe(channelName);
        setChannel(newChannel);
        newChannel.bind(eventName, (data) => {
          // Handle the event data here
          console.log(`Received data from ${eventName}:`, data);
          setMessage(data);
        });
        setIsConnected(true);
      } catch (error) {
        setError("Error occurred, startSocket", error);
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
    if (channel) {
      console.log(channel);
      channel.unbind();
      pusherInstance.unsubscribe(channel.name);
      channel.disconnect();
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
