import { useEffect, useState } from 'react';
import {
  IonApp,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonBadge,
  IonIcon,
  IonLoading,
  IonAlert,
  setupIonicReact,
} from '@ionic/react';
import { checkmarkCircle, closeCircle, person, diamond, cart } from 'ionicons/icons';
import { Capivv } from '@capivv/capacitor-sdk';

setupIonicReact();

function App() {
  const [userId, setUserId] = useState('test-user-123');
  const [isIdentified, setIsIdentified] = useState(false);
  const [hasPremium, setHasPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  useEffect(() => {
    // Initialize Capivv SDK
    initializeCapivv();
  }, []);

  const initializeCapivv = async () => {
    try {
      await Capivv.configure({
        apiKey: 'capivv_pk_test_YOUR_API_KEY',
        debug: true,
      });
      console.log('Capivv SDK initialized');
    } catch (error) {
      console.error('Failed to initialize Capivv:', error);
    }
  };

  const handleIdentify = async () => {
    if (!userId.trim()) return;

    setIsLoading(true);
    try {
      await Capivv.identify({
        userId,
        attributes: {
          source: 'capacitor_example',
          platform: 'mobile',
        },
      });
      setIsIdentified(true);
      setAlertMessage('User identified successfully!');

      // Sync purchases after identification
      await Capivv.syncPurchases();
      await checkEntitlements();
    } catch (error) {
      console.error('Failed to identify user:', error);
      setAlertMessage('Failed to identify user. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const checkEntitlements = async () => {
    try {
      const result = await Capivv.checkEntitlement({
        entitlementIdentifier: 'premium',
      });
      setHasPremium(result.hasAccess);
    } catch (error) {
      console.error('Failed to check entitlements:', error);
    }
  };

  const handleShowPaywall = async () => {
    setShowPaywall(true);
  };

  const handlePurchaseComplete = async (success: boolean) => {
    setShowPaywall(false);
    if (success) {
      setAlertMessage('Purchase successful! Premium access granted.');
      await checkEntitlements();
    }
  };

  const handleRestorePurchases = async () => {
    setIsLoading(true);
    try {
      await Capivv.restorePurchases();
      await checkEntitlements();
      setAlertMessage('Purchases restored successfully!');
    } catch (error) {
      console.error('Failed to restore purchases:', error);
      setAlertMessage('No purchases to restore.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <IonApp>
      <IonPage>
        <IonHeader>
          <IonToolbar color="primary">
            <IonTitle>Capivv Example</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonContent className="ion-padding">
          <IonLoading isOpen={isLoading} message="Please wait..." />

          <IonAlert
            isOpen={!!alertMessage}
            onDidDismiss={() => setAlertMessage('')}
            header="Info"
            message={alertMessage}
            buttons={['OK']}
          />

          {/* User Identification */}
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>
                <IonIcon icon={person} /> Step 1: Identify User
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonList>
                <IonItem>
                  <IonLabel position="floating">User ID</IonLabel>
                  <IonInput
                    value={userId}
                    onIonChange={(e) => setUserId(e.detail.value || '')}
                    disabled={isIdentified}
                    placeholder="Enter user ID"
                  />
                </IonItem>
              </IonList>
              <IonButton
                expand="block"
                onClick={handleIdentify}
                disabled={!userId.trim() || isIdentified}
                className="ion-margin-top"
              >
                {isIdentified ? (
                  <>
                    <IonIcon icon={checkmarkCircle} slot="start" />
                    Identified
                  </>
                ) : (
                  'Identify User'
                )}
              </IonButton>
            </IonCardContent>
          </IonCard>

          {/* Entitlement Status */}
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>
                <IonIcon icon={diamond} /> Step 2: Entitlements
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonItem>
                <IonLabel>Premium Access</IonLabel>
                <IonBadge color={hasPremium ? 'success' : 'danger'}>
                  <IonIcon icon={hasPremium ? checkmarkCircle : closeCircle} />
                  {hasPremium ? ' Active' : ' Not Active'}
                </IonBadge>
              </IonItem>
              <IonButton
                expand="block"
                fill="outline"
                onClick={checkEntitlements}
                disabled={!isIdentified}
                className="ion-margin-top"
              >
                Refresh Entitlements
              </IonButton>
            </IonCardContent>
          </IonCard>

          {/* Paywall */}
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>
                <IonIcon icon={cart} /> Step 3: Subscribe
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <p>
                {hasPremium
                  ? 'You already have premium access!'
                  : 'Show the paywall to subscribe to premium.'}
              </p>
              <IonButton
                expand="block"
                color="primary"
                onClick={handleShowPaywall}
                disabled={!isIdentified || hasPremium}
                className="ion-margin-top"
              >
                Show Paywall
              </IonButton>
              <IonButton
                expand="block"
                fill="clear"
                onClick={handleRestorePurchases}
                disabled={!isIdentified}
              >
                Restore Purchases
              </IonButton>
            </IonCardContent>
          </IonCard>

          {/* Premium Content Preview */}
          {hasPremium && (
            <IonCard color="success">
              <IonCardHeader>
                <IonCardTitle>Premium Content</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <p>
                  Congratulations! You now have access to all premium features.
                </p>
                <ul>
                  <li>Unlimited access to all content</li>
                  <li>No advertisements</li>
                  <li>Priority support</li>
                  <li>Exclusive features</li>
                </ul>
              </IonCardContent>
            </IonCard>
          )}
        </IonContent>
      </IonPage>

      {/* Simple Paywall Modal - in a real app, use CapivvPaywall component */}
      {showPaywall && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <IonCard style={{ maxWidth: '90%', width: '400px' }}>
            <IonCardHeader>
              <IonCardTitle>Upgrade to Premium</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <p>Get unlimited access to all features!</p>
              <ul>
                <li>Unlimited content</li>
                <li>No ads</li>
                <li>Priority support</li>
              </ul>
              <IonButton
                expand="block"
                onClick={() => handlePurchaseComplete(true)}
                className="ion-margin-top"
              >
                Subscribe - $9.99/month
              </IonButton>
              <IonButton
                expand="block"
                fill="clear"
                onClick={() => setShowPaywall(false)}
              >
                Maybe Later
              </IonButton>
            </IonCardContent>
          </IonCard>
        </div>
      )}
    </IonApp>
  );
}

export default App;
