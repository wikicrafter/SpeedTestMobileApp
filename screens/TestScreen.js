// screens/TestScreen.js
import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';

export default function TestScreen() {
  const [latency, setLatency] = useState(null);
  const [downloadSpeed, setDownloadSpeed] = useState(null);
  const [uploadSpeed, setUploadSpeed] = useState(null);
  const [loading, setLoading] = useState(false);

  // Alternative URLs for download speed test with smaller file sizes
  const downloadUrls = [
    'https://file-examples-com.github.io/uploads/2017/10/file_example_JPG_100kB.jpg',
    'https://github.com/mozilla/pdf.js/blob/master/web/compressed.tracemonkey-pldi-09.pdf?raw=true',
    'https://download.samplelib.com/mp4/sample-1s.mp4'
  ];

  // Alternative URLs for upload speed test
  const uploadUrls = [
    'https://httpbin.org/post',
    'https://ptsv2.com/t/n3z2v-1639299935/post',
    'https://postman-echo.com/post'
  ];

  // Alternative URLs for latency test
  const latencyUrls = [
    'https://www.google.com',
    'https://www.cloudflare.com',
    'https://www.amazon.com'
  ];

  // Fetch with retry and fallback for multiple URLs
  const fetchWithRetryAndFallback = async (urls, options, retries = 3, backoff = 500) => {
    for (const url of urls) {
      try {
        const response = await fetchWithRetry(url, options, retries, backoff);
        return response;
      } catch (error) {
        console.error(`Failed to fetch from ${url}, trying next URL if available...`);
      }
    }
    throw new Error('All sources failed.');
  };

  // Basic fetch with retry logic and exponential backoff
  const fetchWithRetry = async (url, options, retries = 3, backoff = 500) => {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }
      return response;
    } catch (error) {
      if (retries > 1) {
        await new Promise(resolve => setTimeout(resolve, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      } else {
        throw error;
      }
    }
  };

  const measureDownloadSpeed = async () => {
    try {
      const downloadStartTime = Date.now();
      const downloadResponse = await fetchWithRetryAndFallback(downloadUrls, {}, 3, 500);
      const downloadEndTime = Date.now();
      const downloadDuration = (downloadEndTime - downloadStartTime) / 1000; // seconds
      const fileSizeMB = 0.1; // Using 100kB (0.1 MB) for testing
      const downloadMbps = ((fileSizeMB * 8) / downloadDuration).toFixed(2); // Mbps calculation
      console.log(`Calculated download speed: ${downloadMbps} Mbps`);
      setDownloadSpeed(downloadMbps);
    } catch (error) {
      console.error("Download speed test failed:", error);
      Alert.alert("Download Test Failed", "Unable to measure download speed.");
      setDownloadSpeed("Error");
    }
  };

  const measureLatency = async () => {
    try {
      const pingStartTime = Date.now();
      await fetchWithRetryAndFallback(latencyUrls, {}, 3, 500);
      const pingEndTime = Date.now();
      const latencyMs = pingEndTime - pingStartTime;
      console.log(`Calculated latency: ${latencyMs} ms`);
      setLatency(latencyMs);
    } catch (error) {
      console.error("Latency test failed:", error);
      Alert.alert("Latency Test Failed", "Unable to measure latency.");
      setLatency("Error");
    }
  };

  const measureUploadSpeed = async () => {
    try {
      const uploadStartTime = Date.now();
      const data = new Uint8Array(1 * 1024 * 1024).fill(0); // 1 MB of data for testing
      await fetchWithRetryAndFallback(uploadUrls, { method: 'POST', body: data }, 3, 500);
      const uploadEndTime = Date.now();
      const uploadDuration = (uploadEndTime - uploadStartTime) / 1000; // seconds
      const uploadMbps = ((1 * 8) / uploadDuration).toFixed(2); // Accurate Mbps calculation
      console.log(`Calculated upload speed: ${uploadMbps} Mbps`);
      setUploadSpeed(uploadMbps);
    } catch (error) {
      console.error("Upload speed test failed:", error);
      Alert.alert("Upload Test Failed", "Unable to measure upload speed.");
      setUploadSpeed("Error");
    }
  };

  const measureNetworkSpeeds = async () => {
    setLoading(true);
    try {
      await Promise.all([measureDownloadSpeed(), measureLatency(), measureUploadSpeed()]);
      await saveResult({
        latency: latency || "Error",
        downloadSpeed: downloadSpeed || "Error",
        uploadSpeed: uploadSpeed || "Error",
        date: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Network speed test failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveResult = async (result) => {
    try {
      const savedHistory = await AsyncStorage.getItem('history');
      const history = savedHistory ? JSON.parse(savedHistory) : [];
      await AsyncStorage.setItem('history', JSON.stringify([...history, result]));
    } catch (error) {
      console.error('Error saving history:', error);
    }
  };

  const copyResults = async () => {
    const resultText = `Results:\nLatency: ${latency} ms\nDownload: ${downloadSpeed} Mbps\nUpload: ${uploadSpeed} Mbps`;
    await Clipboard.setStringAsync(resultText);
    Alert.alert("Copied to Clipboard", "Results have been copied to the clipboard.");
  };

  const chartData = {
    labels: ["Latency", "Download", "Upload"],
    datasets: [
      {
        data: [parseFloat(latency) || 0, parseFloat(downloadSpeed) || 0, parseFloat(uploadSpeed) || 0],
        color: (opacity = 1) => `rgba(134, 65, 244, ${opacity})`,
        strokeWidth: 2,
      }
    ],
    legend: ["Network Speed"]
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Network Speed Test</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <>
          <Button title="Run Speed Test" onPress={measureNetworkSpeeds} />
          <Button title="Copy Results" onPress={copyResults} />
          <Text>Latency: {latency} ms</Text>
          <Text>Download Speed: {downloadSpeed} Mbps</Text>
          <Text>Upload Speed: {uploadSpeed} Mbps</Text>
          <LineChart
            data={chartData}
            width={300}
            height={220}
            yAxisSuffix=" Mbps"
            chartConfig={{
              backgroundColor: '#e26a00',
              backgroundGradientFrom: '#fb8c00',
              backgroundGradientTo: '#ffa726',
              decimalPlaces: 2,
              color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              style: { borderRadius: 16 },
              propsForDots: { r: '6', strokeWidth: '2', stroke: '#ffa726' }
            }}
            style={{ marginVertical: 8, borderRadius: 16 }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, marginBottom: 20 },
});
