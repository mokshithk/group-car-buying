import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { BuyerLayout } from '@/components/layout/BuyerLayout';
import { Button, Card, Badge } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { getWishlist, addToWishlist, removeFromWishlist } from '@/lib/groupService';
import { formatINR } from '@/lib/formatters';
import { Variant, Model } from '@/types';
import { Bookmark, Trash2, ArrowRight, ExternalLink, AlertCircle } from 'lucide-react';

export function WishlistPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const addVariantId = searchParams.get('addVariant');

  const [savedVariants, setSavedVariants] = useState<{ variant: Variant; model: Model }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      try {
        if (addVariantId) {
          const addRes = await addToWishlist(addVariantId, user.id);
          if (!cancelled) {
            if (addRes.success) {
              toast({
                type: addRes.alreadySaved ? 'info' : 'success',
                title: addRes.alreadySaved ? 'Already in Wishlist' : 'Saved to Wishlist',
                message: addRes.alreadySaved
                  ? 'This variant is already tracked in your wishlist.'
                  : 'Variant added to your personal wishlist.',
              });
            } else {
              toast({
                type: 'error',
                title: 'Wishlist Error',
                message: addRes.error || 'Could not add variant to wishlist.',
              });
            }
            navigate('/buyer/wishlist', { replace: true });
          }
        }

        const items = await getWishlist(user.id);
        if (cancelled) return;

        const populated: { variant: Variant; model: Model }[] = [];
        items.forEach((item) => {
          if (item.variant?.model) {
            populated.push({ variant: item.variant, model: item.variant.model });
          }
        });
        setSavedVariants(populated);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Unable to load saved wishlist.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user, addVariantId, toast, navigate]);

  const handleRemove = async (variantId: string) => {
    if (!user) return;
    const res = await removeFromWishlist(variantId, user.id);
    if (!res.success) {
      toast({
        type: 'error',
        title: 'Could Not Remove',
        message: res.error || 'Failed to remove variant from wishlist.',
      });
      return;
    }
    setSavedVariants((prev) => prev.filter((item) => item.variant.id !== variantId));
    toast({
      type: 'info',
      title: 'Removed from Wishlist',
    });
  };

  return (
    <BuyerLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-brand-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              My Saved Wishlist
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track car variants you are considering and find active buying groups in your district.
          </p>
        </div>

        {loadError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-16 text-center text-slate-400">Loading your wishlist...</div>
        ) : savedVariants.length === 0 ? (
          <Card className="text-center py-16 p-8">
            <Bookmark className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">Your wishlist is empty</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-6">
              Browse vehicles from the catalog and tap "Wishlist" on any variant to track it here.
            </p>
            <Link to="/#cars">
              <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Browse Car Catalog
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {savedVariants.map(({ variant, model }) => (
              <Card key={variant.id} className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="brand" size="sm">
                        {model.manufacturer?.name}
                      </Badge>
                      <Badge variant="outline" size="sm">
                        {variant.transmission}
                      </Badge>
                      <Badge variant="default" size="sm">
                        {variant.fuel_type}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {model.name} — {variant.name}
                    </h3>
                    <div className="text-xs text-slate-500">
                      Indicative Ex-Showroom:{' '}
                      <strong className="text-slate-900 font-bold">
                        {formatINR(variant.ex_showroom_price)}
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <Link to={`/buyer/groups/find?variantId=${variant.id}`}>
                      <Button variant="primary" size="sm" rightIcon={<ExternalLink className="w-4 h-4" />}>
                        Find Groups
                      </Button>
                    </Link>
                    <button
                      onClick={() => handleRemove(variant.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Remove from wishlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </BuyerLayout>
  );
}
