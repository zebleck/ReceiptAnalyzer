import { useState, useRef } from 'react';
import { StyleSheet, Image, StatusBar, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Text, View } from '@/components/Themed';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { Button, IconButton, Surface, ActivityIndicator, Card, TextInput, List, Snackbar } from 'react-native-paper';
import { analyzeReceipt } from '@/services/receiptAnalyzer';
import * as FileSystem from 'expo-file-system';
import { receiptService } from '@/services/receiptService';
import { Button as RNPButton } from 'react-native-paper';

interface ReceiptItem {
  id: string;
  receipt_id: string;
  name: string;
  price?: number;
  quantity?: number;
  created_at: string;
  tempPrice?: string;
  tempQuantity?: string;
}

export default function TabThreeScreen() {
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [image, setImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<{
    store: { name: string };
    receipt_uid?: string;
    address?: {
      street?: string;
      postal_code?: string;
      city?: string;
    };
    date: string;
    time: string;
    items: ReceiptItem[];
    total: number;
    taxAmount?: number;
    tempTaxAmount?: string;
    tempQualityRating?: string;
    tempTotal?: string;
    quality_rating: number;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [snackbar, setSnackbar] = useState({
    visible: false,
    message: '',
    type: 'success' as 'success' | 'error'
  });

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
          
          // Only save to library and convert to base64 if not on web
          if (Platform.OS !== 'web') {
            await MediaLibrary.saveToLibraryAsync(photo.uri);
            const base64 = await FileSystem.readAsStringAsync(photo.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            handleImageAnalysis(base64);
          } else {
            // On web, just use the URI directly
            handleImageAnalysis(photo.uri);
          }
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
      setAnalysis(result as any);
    } catch (error) {
      console.error('Error analyzing receipt:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveReceipt = async () => {
    try {
      if (!analysis) return;

      await receiptService.saveReceipt(
        {
          store_name: analysis.store.name,
          receipt_uid: analysis.receipt_uid,
          street: analysis.address?.street,
          postal_code: analysis.address?.postal_code,
          city: analysis.address?.city,
          timestamp: '',
          total: analysis.total,
          tax_amount: analysis.taxAmount,
          user_id: 'temp_user_id',
          quality_rating: analysis.quality_rating,
        },
        analysis.items.map(item => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity || 1,
        })),
        image || undefined,
        { date: analysis.date, time: analysis.time }
      );

      // Show success message
      setSnackbar({
        visible: true,
        message: 'Receipt saved successfully!',
        type: 'success'
      });

      // Clear the form after successful save
      setEditMode(false);
      setImage(null);
      setAnalysis(null);

    } catch (error) {
      console.error('Error saving receipt:', error);
      // Show error message
      setSnackbar({
        visible: true,
        message: 'Failed to save receipt. Please try again.',
        type: 'error'
      });
    }
  };

  const handleFileUpload = async () => {
    try {
      // Create a file input element
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      
      // Handle file selection
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        // Create object URL for preview
        const imageUri = URL.createObjectURL(file);
        setImage(imageUri);

        // Convert to base64 for analysis
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64 = (event.target?.result as string)?.split(',')[1];
          if (base64) {
            handleImageAnalysis(base64);
          }
        };
        reader.readAsDataURL(file);
      };

      input.click();
    } catch (error) {
      console.error('Error uploading file:', error);
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
              <>
                <TextInput
                  label="Date"
                  value={analysis.date}
                  onChangeText={(text) => 
                    setAnalysis({...analysis, date: text})}
                  style={styles.input}
                />
                <TextInput
                  label="Time"
                  value={analysis.time}
                  onChangeText={(text) => 
                    setAnalysis({...analysis, time: text})}
                  style={styles.input}
                />
                <TextInput
                  label="Receipt UID"
                  value={analysis.receipt_uid || ''}
                  onChangeText={(text) => 
                    setAnalysis({...analysis, receipt_uid: text})}
                  style={styles.input}
                />
                <TextInput
                  label="Street"
                  value={analysis.address?.street || ''}
                  onChangeText={(text) => 
                    setAnalysis({
                      ...analysis, 
                      address: {...(analysis.address || {}), street: text}
                    })}
                  style={styles.input}
                />
                <TextInput
                  label="Postal Code"
                  value={analysis.address?.postal_code || ''}
                  onChangeText={(text) => 
                    setAnalysis({
                      ...analysis, 
                      address: {...(analysis.address || {}), postal_code: text}
                    })}
                  style={styles.input}
                />
                <TextInput
                  label="City"
                  value={analysis.address?.city || ''}
                  onChangeText={(text) => 
                    setAnalysis({
                      ...analysis, 
                      address: {...(analysis.address || {}), city: text}
                    })}
                  style={styles.input}
                />
                <TextInput
                  label="Quality Rating (1-10)"
                  value={analysis.tempQualityRating !== undefined ? analysis.tempQualityRating : analysis.quality_rating?.toString()}
                  onChangeText={(text) => {
                    const rating = Number(text.replace(',', '.'));
                    setAnalysis({
                      ...analysis,
                      tempQualityRating: text,
                      quality_rating: !isNaN(rating) && rating >= 1 && rating <= 10 ? rating : analysis.quality_rating
                    });
                  }}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </>
            ) : (
              <>
                <Text style={styles.subtitle}>{analysis.date}</Text>
                <Text style={styles.subtitle}>{analysis.time}</Text>
                {analysis.receipt_uid && (
                  <Text style={styles.subtitle}>Receipt UID: {analysis.receipt_uid}</Text>
                )}
                {analysis.address && (
                  <Text style={styles.subtitle}>
                    {[
                      analysis.address.street,
                      analysis.address.postal_code,
                      analysis.address.city
                    ].filter(Boolean).join(', ')}
                  </Text>
                )}
                <Text style={styles.subtitle}>
                  Quality Rating: {analysis.quality_rating}/10
                </Text>
              </>
            )}
            
            <List.Section>
              <List.Subheader>Items</List.Subheader>
              {analysis.items.map((item: ReceiptItem, index: number) => (
                <List.Item
                  key={index}
                  title={editMode ? (
                    <View style={styles.itemTitleContainer}>
                      <TextInput
                        value={item.name}
                        onChangeText={(text) => {
                          const newItems = [...analysis.items];
                          newItems[index] = {...item, name: text};
                          setAnalysis({...analysis, items: newItems});
                        }}
                        style={styles.itemNameInput}
                      />
                      <IconButton
                        icon="delete"
                        size={20}
                        onPress={() => {
                          const newItems = analysis.items.filter((_, i) => i !== index);
                          setAnalysis({...analysis, items: newItems});
                        }}
                      />
                    </View>
                  ) : (
                    item.name
                  )}
                  description={editMode ? (
                    <TextInput
                      value={item.tempPrice !== undefined ? item.tempPrice : item.price?.toString() || '0'}
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
                    `$${item.price?.toFixed(2) || '0.00'}`
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

            {editMode && (
              <View style={styles.itemControls}>
                <Button 
                  mode="outlined" 
                  onPress={() => {
                    setAnalysis({
                      ...analysis,
                      items: [
                        ...analysis.items,
                        {
                          id: `temp-${Date.now()}`,
                          receipt_id: '',
                          name: '',
                          created_at: new Date().toISOString(),
                          tempPrice: '',
                          tempQuantity: ''
                        }
                      ]
                    });
                  }}
                  style={styles.addButton}
                >
                  Add Item
                </Button>
              </View>
            )}

            {editMode ? (
              <>
                <TextInput
                  label="Tax Amount"
                  value={analysis.tempTaxAmount !== undefined ? analysis.tempTaxAmount : analysis.taxAmount?.toString() || ''}
                  onChangeText={(text) => 
                    setAnalysis({
                      ...analysis,
                      tempTaxAmount: text,
                      taxAmount: text.trim() ? Number(text.replace(',', '.')) : undefined
                    })}
                  keyboardType="numeric"
                  style={styles.input}
                />
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
              </>
            ) : (
              <>
                {analysis.taxAmount && (
                  <Text style={styles.subtitle}>Tax: ${analysis.taxAmount.toFixed(2)}</Text>
                )}
                <Text style={styles.total}>Total: ${analysis.total.toFixed(2)}</Text>
              </>
            )}
          </Card.Content>
          <Card.Actions>
            <Button onPress={() => {
              setEditMode(false);
              setAnalysis(null);
            }}>Cancel</Button>
            <Button 
              mode="contained" 
              onPress={handleSaveReceipt}
            >
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
      ) : Platform.OS === 'web' ? (
        <View style={styles.webUploadContainer}>
          <RNPButton
            mode="contained"
            onPress={handleFileUpload}
            style={styles.button}
          >
            Upload Image
          </RNPButton>
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

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar(prev => ({ ...prev, visible: false }))}
        duration={3000}
        style={[
          styles.snackbar,
          { backgroundColor: snackbar.type === 'success' ? '#4CAF50' : '#F44336' }
        ]}
        action={{
          label: 'Dismiss',
          onPress: () => setSnackbar(prev => ({ ...prev, visible: false })),
        }}
      >
        {snackbar.message}
      </Snackbar>
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
  itemTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
  webUploadContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  snackbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    margin: 16,
  },
  itemControls: {
    marginTop: 8,
    marginBottom: 16,
  },
  addButton: {
    marginTop: 8,
  },
});