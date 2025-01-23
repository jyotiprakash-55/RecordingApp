/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, {useState, useEffect} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import AudioRecorderPlayer, { 
  AudioSet, 
  AVEncodingOption,
  AVEncoderAudioQualityIOSType
} from 'react-native-audio-recorder-player';
import Slider from '@react-native-community/slider';
import {request, PERMISSIONS, RESULTS} from 'react-native-permissions';
import RNFS from 'react-native-fs';

const audioRecorderPlayer = new AudioRecorderPlayer();

const formatTime = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

function App(): React.JSX.Element {
  const [fileName, setFileName] = useState('test file');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordTime, setRecordTime] = useState('00:00:00');
  const [currentPositionSec, setCurrentPositionSec] = useState(0);
  const [currentDurationSec, setCurrentDurationSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playTime, setPlayTime] = useState('00:00:00');

  useEffect(() => {
    checkPermission();
    return () => {
      audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.stopPlayer();
    };
  }, []);

  const checkPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const grants = await request(PERMISSIONS.ANDROID.RECORD_AUDIO);
        if (grants === RESULTS.GRANTED) {
          console.log('Permissions granted');
        } else {
          Alert.alert('Permission Required', 'This app needs audio recording permission to work');
          return;
        }
      } catch (err) {
        console.warn(err);
        return;
      }
    } else if (Platform.OS === 'ios') {
      try {
        const grants = await request(PERMISSIONS.IOS.MICROPHONE);
        if (grants === RESULTS.GRANTED) {
          console.log('Permissions granted');
        } else {
          Alert.alert('Permission Required', 'This app needs microphone permission to work');
          return;
        }
      } catch (err) {
        console.warn(err);
        return;
      }
    }
  };

  const onStartRecord = async () => {
    try {
      // Make sure we have permissions first
      await checkPermission();

      // Create directory if it doesn't exist (for Android)
      if (Platform.OS === 'android') {
        const exists = await RNFS.exists(RNFS.CachesDirectoryPath);
        if (!exists) {
          await RNFS.mkdir(RNFS.CachesDirectoryPath);
        }
      }

      const path = Platform.select({
        ios: `${RNFS.DocumentDirectoryPath}/recording.m4a`,
        android: `${RNFS.CachesDirectoryPath}/recording.mp3`,
      }) || '';

      // Clean up any existing recording first
      try {
        await RNFS.unlink(path);
      } catch (e: unknown) {
        // It's okay if the file doesn't exist
      }

      const audioSet: AudioSet = {
        AudioEncoderAndroid: 3, // AAC
        AudioSourceAndroid: 6, // MIC
        OutputFormatAndroid: 6, // AAC_ADTS
        AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
        AVNumberOfChannelsKeyIOS: 2,
        AVFormatIDKeyIOS: AVEncodingOption.aac,
        AVSampleRateKeyIOS: 44100,
      };

      console.log('Starting recording at path:', path);
      const uri = await audioRecorderPlayer.startRecorder(path, audioSet);
      console.log('Recording started at:', uri);

      audioRecorderPlayer.addRecordBackListener((e) => {
        console.log('Recording progress:', e);
        setRecordTime(formatTime(e.currentPosition));
      });
      setIsRecording(true);
    } catch (error: unknown) {
      console.error('Error starting recording:', error);
      Alert.alert(
        'Recording Error',
        `Failed to start recording: ${(error as Error)?.message || 'Unknown error'}. Please check app permissions and try again.`
      );
    }
  };

  const onPauseRecord = async () => {
    await audioRecorderPlayer.pauseRecorder();
    setIsPaused(true);
  };

  const onResumeRecord = async () => {
    await audioRecorderPlayer.resumeRecorder();
    setIsPaused(false);
  };

  const onStopRecord = async () => {
    await audioRecorderPlayer.stopRecorder();
    audioRecorderPlayer.removeRecordBackListener();
    setRecordTime('00:00:00');
    setIsRecording(false);
    setIsPaused(false);
  };

  const onStartPlay = async () => {
    try {
      if (isPlaying) {
        await onPausePlay();
        return;
      }

      const path = Platform.select({
        ios: `${RNFS.DocumentDirectoryPath}/recording.m4a`,
        android: `${RNFS.CachesDirectoryPath}/recording.mp3`,
      }) || '';

      console.log('Starting playback from path:', path);
      const msg = await audioRecorderPlayer.startPlayer(path);
      console.log('Playback started:', msg); 
      audioRecorderPlayer.addPlayBackListener((e) => {
        if (e.currentPosition === e.duration) {
          onStopPlay();
        }
        console.log('Playing progress:', e);
        setCurrentPositionSec(e.currentPosition);
        setCurrentDurationSec(e.duration);
        setPlayTime(formatTime(e.currentPosition));
      });
      setIsPlaying(true);
    } catch (error: unknown) {
      console.error('Error playing recording:', error);
      Alert.alert('Error', 'Failed to play recording. Please try recording first.');
    }
  };

  const onPausePlay = async () => {
    await audioRecorderPlayer.pausePlayer();
    setIsPlaying(false);
  };

  const onStopPlay = async () => {
    await audioRecorderPlayer.stopPlayer();
    audioRecorderPlayer.removePlayBackListener();
    setIsPlaying(false);
    setCurrentPositionSec(0);
    setPlayTime('00:00:00');
  };

  const onSliderChange = async (value: number) => {
    await audioRecorderPlayer.seekToPlayer(value);
  };

  const onForward = async () => {
    const newPosition = Math.min(currentPositionSec + 5000, currentDurationSec);
    await audioRecorderPlayer.seekToPlayer(newPosition);
  };

  const onRewind = async () => {
    const newPosition = Math.max(currentPositionSec - 5000, 0);
    await audioRecorderPlayer.seekToPlayer(newPosition);
  };

  const saveRecording = async () => {
    if (!fileName.trim()) {
      Alert.alert('Error', 'Please enter a file name');
      return;
    }
    const sourcePath = Platform.select({
      ios: `${RNFS.DocumentDirectoryPath}/recording.m4a`,
      android: `${RNFS.CachesDirectoryPath}/recording.mp3`,
    }) || '';
    const destPath = `${RNFS.DocumentDirectoryPath}/${fileName}.mp3`; 
    try {
      const exists = await RNFS.exists(sourcePath);
      if (!exists) {
        Alert.alert('Error', 'No recording found. Please record something first.');
        return;
      }
      await RNFS.copyFile(sourcePath, destPath);
      Alert.alert('Success', 'Recording saved successfully');
    } catch (error: unknown) {
      console.error('Error saving recording:', error);
      Alert.alert('Error', `Failed to save recording: ${(error as Error)?.message || 'Unknown error'}`);
    }
  };

  const deleteRecording = async () => {
    await onStopPlay();
    await onStopRecord();
    const path = Platform.select({
      ios: 'recording.m4a',
      android: `${RNFS.CachesDirectoryPath}/recording.mp3`,
    }) || '';
    try {
      await RNFS.unlink(path);
      setCurrentPositionSec(0);
      setCurrentDurationSec(0);
      setPlayTime('00:00:00');
    } catch (error: unknown) {
      console.log('File may not exist');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TextInput
        style={styles.input}
        value={fileName}
        onChangeText={setFileName}
        placeholder="Enter file name"
      />
      <Text style={styles.statusText}>
        {isRecording ? 'RECORDING....' : isPaused ? 'PAUSED' : ''}
      </Text>
      <View style={styles.recordingCircle}>
        <TouchableOpacity
          style={styles.recordButton}
          onPress={isRecording ? (isPaused ? onResumeRecord : onPauseRecord) : onStartRecord}>
          <Text style={styles.recordButtonText}>
            {isRecording ? (isPaused ? '▶' : '||') : '●'}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.timeText}>RECORDING TIME</Text>
      <Text style={styles.timerText}>{isRecording ? recordTime : playTime}</Text>
      {!isRecording && (
        <>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={currentDurationSec}
            value={currentPositionSec}
            onValueChange={onSliderChange}
            minimumTrackTintColor="#1E88E5"
            maximumTrackTintColor="#D5D5D5"
          />
          <View style={styles.controls}>
            <TouchableOpacity style={styles.controlButton} onPress={onRewind}>
              <Text style={styles.controlButtonText}>◀◀</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton} onPress={onStartPlay}>
              <Text style={styles.controlButtonText}>{isPlaying ? '||' : '▶'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton} onPress={onForward}>
              <Text style={styles.controlButtonText}>▶▶</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.bottomControls}>
            <TouchableOpacity style={styles.bottomButton} onPress={deleteRecording}>
              <Text style={styles.bottomButtonText}>DELETE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bottomButton}>
              <Text style={styles.bottomButtonText}>UPLOAD</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bottomButton} onPress={saveRecording}>
              <Text style={styles.bottomButtonText}>SAVE</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    padding: 20,
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
    backgroundColor: '#FFF',
  },
  statusText: {
    color: '#4CAF50',
    fontSize: 18,
    marginBottom: 20,
  },
  recordingCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonText: {
    color: '#FFF',
    fontSize: 24,
  },
  timeText: {
    color: '#757575',
    fontSize: 16,
    marginBottom: 10,
  },
  timerText: {
    color: '#2196F3',
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  controlButtonText: {
    color: '#FFF',
    fontSize: 18,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    position: 'absolute',
    bottom: 40,
    paddingHorizontal: 20,
  },
  bottomButton: {
    padding: 10,
  },
  bottomButtonText: {
    color: '#2196F3',
    fontSize: 14,
  },
});

export default App;
