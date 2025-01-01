import { useState, useRef } from 'react';
import { StyleSheet, Image, StatusBar, ScrollView, TouchableOpacity } from 'react-native';
import { Text, View } from '@/components/Themed';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { Button, IconButton, Surface, ActivityIndicator, Card, TextInput, List } from 'react-native-paper';
import { analyzeReceipt } from '@/services/receiptAnalyzer';
import * as FileSystem from 'expo-file-system';

interface ReceiptItem {
  name: string;
  price: number;
  quantity?: number;
  tempPrice?: string;
  tempQuantity?: string;
}

export default function TabThreeScreen() {
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [image, setImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<{
    store: { name: string };
    date: string;
    items: ReceiptItem[];
    total: number;
    tempTotal?: string;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return <View />;
  }
  
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Surface style={styles.permissionCard}>
          <Text style={styles.title}>Camera Permission Required</Text>
          <Text style={styles.subtitle}>
            We need your permission to use the camera
          </Text>
          <Button
            mode="contained"
            onPress={requestPermission}
            style={styles.button}
          >
            Grant Permission
          </Button>
        </Surface>
      </View>
    );
  }
  
  const toggleCameraType = () => {
    setFacing(current => (
      current === 'back' ? 'front' : 'back'
    ));
  };
  
  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
        });
        if (photo?.uri) {
          setImage(photo.uri);
          await MediaLibrary.saveToLibraryAsync(photo.uri);
  
          // Convert image to base64
          const base64 = await FileSystem.readAsStringAsync(photo.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          // Pass base64 data to analysis
          handleImageAnalysis(base64);
        }
      } catch (e) {
        console.error('Error taking picture:', e);
      }
    }
  };
  
  const handleImageAnalysis = async (base64Data: string) => {
    try {
      setIsAnalyzing(true);
      const result = await analyzeReceipt(base64Data);
      setAnalysis(result);
    } catch (error) {
      console.error('Error analyzing receipt:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderAnalysisResults = () => {
    if (!analysis) return null;

    return (
      <ScrollView style={styles.analysisContainer}>
        <TouchableOpacity 
          onPress={() => setIsImageExpanded(!isImageExpanded)}
          style={styles.thumbnailContainer}
        >
          <Image 
            source={{ uri: image || undefined }} 
            style={[
              styles.thumbnail,
              isImageExpanded && styles.expandedImage
            ]} 
          />
          <Text style={styles.thumbnailText}>
            {isImageExpanded ? 'Tap to minimize' : 'Tap to expand'}
          </Text>
        </TouchableOpacity>

        <Card style={styles.card}>
          <Card.Title 
            title="Receipt Details" 
            right={(props) => (
              <IconButton
                {...props}
                icon={editMode ? "check" : "pencil"}
                onPress={() => setEditMode(!editMode)}
              />
            )}
          />
          <Card.Content>
            {editMode ? (
              <TextInput
                label="Store"
                value={analysis.store.name}
                onChangeText={(text) => 
                  setAnalysis({...analysis, store: {...analysis.store, name: text}})}
                style={styles.input}
              />
            ) : (
              <Text style={styles.title}>{analysis.store.name}</Text>
            )}
            
            {editMode ? (
              <TextInput
                label="Date"
                value={analysis.date}
                onChangeText={(text) => 
                  setAnalysis({...analysis, date: text})}
                style={styles.input}
              />
            ) : (
              <Text style={styles.subtitle}>{analysis.date}</Text>
            )}
            
            <List.Section>
              <List.Subheader>Items</List.Subheader>
              {analysis.items.map((item: ReceiptItem, index: number) => (
                <List.Item
                  key={index}
                  title={editMode ? (
                    <TextInput
                      value={item.name}
                      onChangeText={(text) => {
                        const newItems = [...analysis.items];
                        newItems[index] = {...item, name: text};
                        setAnalysis({...analysis, items: newItems});
                      }}
                      style={styles.itemNameInput}
                    />
                  ) : (
                    item.name
                  )}
                  description={editMode ? (
                    <TextInput
                      value={item.tempPrice !== undefined ? item.tempPrice : item.price.toString()}
                      onChangeText={(text) => {
                        const newItems = [...analysis.items];
                        newItems[index] = {
                          ...item,
                          tempPrice: text,
                          price: text.trim() ? Number(text.replace(',', '.')) || 0 : 0
                        };
                        setAnalysis({...analysis, items: newItems});
                      }}
                      keyboardType="numeric"
                      style={styles.priceInput}
                    />
                  ) : (
                    `$${item.price.toFixed(2)}`
                  )}
                  right={() => editMode ? (
                    <TextInput
                      value={item.tempQuantity !== undefined ? item.tempQuantity : (item.quantity?.toString() || "1")}
                      onChangeText={(text) => {
                        const newItems = [...analysis.items];
                        newItems[index] = {
                          ...item,
                          tempQuantity: text,
                          quantity: text.trim() ? parseInt(text) || 1 : 1
                        };
                        setAnalysis({...analysis, items: newItems});
                      }}
                      keyboardType="numeric"
                      style={styles.quantityInput}
                    />
                  ) : (
                    <Text>Qty: {item.quantity || 1}</Text>
                  )}
                />
              ))}
            </List.Section>

            {editMode ? (
              <TextInput
                label="Total"
                value={analysis.tempTotal !== undefined ? analysis.tempTotal : analysis.total.toString()}
                onChangeText={(text) => 
                  setAnalysis({
                    ...analysis,
                    tempTotal: text,
                    total: text.trim() ? Number(text.replace(',', '.')) || 0 : 0
                  })}
                keyboardType="numeric"
                style={styles.input}
              />
            ) : (
              <Text style={styles.total}>Total: ${analysis.total.toFixed(2)}</Text>
            )}
          </Card.Content>
          <Card.Actions>
            <Button onPress={() => {
              setEditMode(false);
              setAnalysis(null);
            }}>Cancel</Button>
            <Button mode="contained" onPress={() => {
              // TODO: Save to database
              console.log('Saving analysis:', analysis);
              setEditMode(false);
              setImage(null);
              setAnalysis(null);
            }}>
              Save
            </Button>
          </Card.Actions>
        </Card>
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      {image ? (
        <View style={styles.imageContainer}>
          {isAnalyzing ? (
            <Surface style={styles.loadingContainer}>
              <ActivityIndicator size="large" />
              <Text style={styles.loadingText}>Analyzing Receipt...</Text>
            </Surface>
          ) : analysis ? (
            renderAnalysisResults()
          ) : (
            <Surface style={styles.controls}>
              <Button
                mode="contained"
                onPress={() => setImage(null)}
                icon="camera"
                style={styles.button}
              >
                Take Another Photo
              </Button>
            </Surface>
          )}
        </View>
      ) : (
        <View style={styles.cameraContainer}>
          <CameraView 
            style={styles.camera} 
            facing={facing}
            ref={cameraRef}
          >
            <Surface style={styles.controls}>
              <IconButton
                icon="camera-flip"
                mode="contained"
                size={30}
                onPress={toggleCameraType}
                style={styles.iconButton}
              />
              <IconButton
                icon="camera"
                mode="contained"
                size={50}
                onPress={takePicture}
                style={styles.iconButton}
              />
            </Surface>
          </CameraView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 1,
  },
  imageContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 20,
  },
  button: {
    marginVertical: 10,
    borderRadius: 8,
  },
  iconButton: {
    backgroundColor: 'white',
    margin: 8,
  },
  permissionCard: {
    padding: 20,
    margin: 20,
    borderRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  analysisContainer: {
    flex: 1,
    width: '100%',
  },
  card: {
    margin: 16,
  },
  input: {
    marginVertical: 8,
  },
  quantityInput: {
    width: 50,
    height: 40,
    textAlign: 'center',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  loadingText: {
    color: 'white',
    marginTop: 16,
  },
  thumbnailContainer: {
    alignItems: 'center',
    margin: 16,
  },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginBottom: 8,
  },
  expandedImage: {
    width: '100%',
    height: 300,
    resizeMode: 'contain',
  },
  thumbnailText: {
    color: '#666',
    fontSize: 12,
  },
  itemNameInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
    backgroundColor: 'transparent',
  },
  total: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'right',
  },
  priceInput: {
    fontSize: 14,
    padding: 0,
    backgroundColor: 'transparent',
    width: 80,
  },
});